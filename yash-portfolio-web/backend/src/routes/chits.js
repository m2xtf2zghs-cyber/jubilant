const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination } = require('../utils/http');
const { requireRoles } = require('../middleware/auth');
const {
  summarizeChit,
  summarizePortfolio,
  toAmount,
  normalizeReturnsMode,
  normalizeTreasuryPolicy,
  buildAutoAttributedReturnsLoanLinked,
  buildTreasuryPoolAttributedReturns,
  calcCollectionSplitForAttribution,
} = require('../services/chit-calculations');

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value, fieldName) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is invalid`);
  return d;
}

function asDateOnly(value, fieldName) {
  if (!value) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is required`);
  const d = asDate(value, fieldName);
  return d.toISOString().slice(0, 10);
}

function ymd(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function addMonthsPreserveDay(dateValue, months) {
  const d = new Date(`${dateValue}T00:00:00.000Z`);
  const day = d.getUTCDate();
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

function buildInstallmentSchedule({ startDate, tenureMonths, installmentAmount }) {
  const rows = [];
  for (let i = 0; i < tenureMonths; i += 1) {
    rows.push({
      installmentNo: i + 1,
      dueDate: addMonthsPreserveDay(startDate, i),
      expectedAmount: Number(Number(installmentAmount).toFixed(2)),
    });
  }
  return rows;
}

function generateChitCode() {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CHIT-${stamp}-${rand}`;
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(v)) return true;
  if (['0', 'false', 'no', 'n'].includes(v)) return false;
  return fallback;
}

function monthBounds(month) {
  if (!month) return null;
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new ApiError(422, 'VALIDATION_ERROR', 'month must be YYYY-MM');
  const [y, m] = String(month).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function insertAuditLog(dbClient, { orgId, userId, entityType, entityId, action, beforeData, afterData, metadata }) {
  await query(
    `
    insert into audit_logs (
      organization_id, actor_user_id, entity_type, entity_id, action,
      before_data, after_data, metadata
    ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
    `,
    [
      orgId,
      userId || null,
      entityType,
      entityId || null,
      action,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      JSON.stringify(metadata || {}),
    ],
    dbClient,
  );
}

function chitJournalAccounts(mode = 'FINANCING') {
  if (String(mode).toUpperCase() === 'SAVING_ASSET') {
    return {
      chitAsset: { code: 'CHIT_ACCUM', name: 'Chit Accumulation Asset' },
      chitCost: { code: 'CHIT_COST', name: 'Chit Discount / Fees Cost' },
      bank: { code: 'BANK', name: 'Bank / Cash' },
      allocation: { code: 'CHIT_DEPLOY', name: 'Chit Funds Deployed' },
      return: { code: 'CHIT_RETURN', name: 'Return to Chit Pool' },
    };
  }
  return {
    chitAsset: { code: 'CHIT_FACILITY', name: 'Chit Facility / Receivable' },
    chitCost: { code: 'CHIT_FIN_COST', name: 'Chit Financing Cost' },
    bank: { code: 'BANK', name: 'Bank / Cash' },
    allocation: { code: 'CHIT_DEPLOY', name: 'Chit Funds Deployed' },
    return: { code: 'CHIT_RETURN', name: 'Return to Chit Pool' },
  };
}

async function insertChitJournalLines(dbClient, { orgId, userId, chitId, sourceEventType, sourceEventId, postingDate, lines }) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const result = await query(
      `
      insert into chit_journal_entries (
        organization_id, chit_id, source_event_type, source_event_id, posting_date,
        line_no, account_code, account_name, dr_amount, cr_amount, narration, ledger_entry_id, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      returning *
      `,
      [
        orgId,
        chitId,
        sourceEventType,
        sourceEventId,
        postingDate,
        i + 1,
        l.accountCode || null,
        l.accountName,
        toAmount(l.drAmount),
        toAmount(l.crAmount),
        l.narration || null,
        l.ledgerEntryId || null,
        userId || null,
      ],
      dbClient,
    );
    out.push(result.rows[0]);
  }
  return out;
}

async function insertMirrorLedgerEntry(dbClient, { orgId, userId, txType, amount, description, entryTime, category, chitId }) {
  const result = await query(
    `
    insert into ledger_entries (
      organization_id, entry_time, tx_type, tag, amount, description, category, manual_reference, created_by
    ) values ($1,$2,$3,'ADJUSTMENT',$4,$5,$6,$7,$8)
    returning *
    `,
    [orgId, entryTime, txType, amount, description, category || null, chitId ? `CHIT:${chitId}` : null, userId || null],
    dbClient,
  );
  return result.rows[0];
}

async function getChitOrThrow(dbClient, orgId, chitId, { forUpdate = false } = {}) {
  const sql = `select * from chits where organization_id = $1 and id = $2 ${forUpdate ? 'for update' : ''}`;
  const r = await query(sql, [orgId, chitId], dbClient);
  const row = r.rows[0];
  if (!row) throw new ApiError(404, 'CHIT_NOT_FOUND', 'Chit not found');
  return row;
}

async function getChitReceipt(dbClient, orgId, chitId) {
  const r = await query(`select * from chit_receipts where organization_id=$1 and chit_id=$2`, [orgId, chitId], dbClient);
  return r.rows[0] || null;
}

async function getChitPayments(dbClient, orgId, chitId) {
  const r = await query(`select * from chit_installment_payments where organization_id=$1 and chit_id=$2 order by payment_date asc, created_at asc`, [orgId, chitId], dbClient);
  return r.rows;
}

async function getChitAllocations(dbClient, orgId, chitId) {
  const r = await query(`select * from fund_source_allocations where organization_id=$1 and source_type='CHIT' and chit_id=$2 order by allocation_date asc, created_at asc`, [orgId, chitId], dbClient);
  return r.rows;
}

async function getChitReturns(dbClient, orgId, chitId) {
  const r = await query(`select * from chit_capital_returns where organization_id=$1 and chit_id=$2 order by return_date asc, created_at asc`, [orgId, chitId], dbClient);
  return r.rows;
}

function extractLinkedLoanIdsFromAllocations(allocations = []) {
  return Array.from(new Set(
    allocations
      .filter((a) => String(a.purpose || '').toUpperCase() === 'LENDING' && (a.linked_loan_id || a.linkedLoanId))
      .map((a) => a.linked_loan_id || a.linkedLoanId),
  ));
}

async function fetchLoanAttributionInputs(dbClient, orgId, loanIds = []) {
  if (!Array.isArray(loanIds) || !loanIds.length) {
    return { loansById: {}, collectionsByLoan: new Map() };
  }

  const [loansRes, collectionsRes] = await Promise.all([
    query(
      `
      select id, principal_amount, interest_amount, total_amount
      from loans
      where organization_id = $1 and id = any($2::uuid[])
      `,
      [orgId, loanIds],
      dbClient,
    ),
    query(
      `
      select
        id, loan_id, amount, collection_date,
        principal_component, interest_component, is_writeoff
      from collections
      where organization_id = $1 and loan_id = any($2::uuid[])
      order by collection_date asc, created_at asc
      `,
      [orgId, loanIds],
      dbClient,
    ),
  ]);

  const loansById = Object.fromEntries(loansRes.rows.map((r) => [r.id, r]));
  const collectionsByLoan = new Map();
  for (const c of collectionsRes.rows) {
    if (!collectionsByLoan.has(c.loan_id)) collectionsByLoan.set(c.loan_id, []);
    collectionsByLoan.get(c.loan_id).push(c);
  }
  return { loansById, collectionsByLoan };
}

async function fetchAllCollectionsForTreasuryAttribution(dbClient, orgId) {
  const result = await query(
    `
    select
      co.id, co.loan_id, co.amount, co.collection_date,
      co.principal_component, co.interest_component, co.is_writeoff,
      l.principal_amount, l.interest_amount, l.total_amount
    from collections co
    left join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
    where co.organization_id = $1
    order by co.collection_date asc, co.created_at asc
    `,
    [orgId],
    dbClient,
  );
  return result.rows;
}

function flattenCollectionsForLoanIds(loanIds = [], collectionsByLoan = new Map()) {
  const seen = new Set();
  const out = [];
  for (const loanId of loanIds) {
    const rows = collectionsByLoan.get(loanId) || [];
    for (const r of rows) {
      const key = r.id || `${loanId}:${r.collection_date}:${r.amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  out.sort((a, b) => new Date(a.collection_date || a.collectionDate) - new Date(b.collection_date || b.collectionDate));
  return out;
}

function buildEffectiveReturnsForChit({
  chit,
  allocations = [],
  manualReturns = [],
  returnsMode = 'HYBRID',
  loansById = {},
  collectionsByLoan = new Map(),
}) {
  const linkedLoanIds = extractLinkedLoanIdsFromAllocations(allocations);
  const collections = flattenCollectionsForLoanIds(linkedLoanIds, collectionsByLoan);
  const derived = buildAutoAttributedReturnsLoanLinked({
    chit,
    allocations,
    manualReturns,
    collections,
    loansById,
    mode: returnsMode,
  });
  return derived;
}

function combineAutoAndManualReturns({ autoReturns = [], manualReturns = [], returnsMode = 'HYBRID' }) {
  const mode = normalizeReturnsMode(returnsMode);
  const manual = [...manualReturns].map((r) => ({ ...r, _autoDerived: false }));
  if (mode === 'MANUAL') return { returnsMode: mode, effectiveReturns: manual };
  if (mode === 'AUTO') return { returnsMode: mode, effectiveReturns: [...autoReturns] };

  const manualCollectionIds = new Set(manual.map((r) => r.linked_collection_id || r.linkedCollectionId).filter(Boolean));
  const filteredAuto = autoReturns.filter((r) => {
    const cid = r.linked_collection_id || r.linkedCollectionId;
    return !(cid && manualCollectionIds.has(cid));
  });
  return { returnsMode: mode, effectiveReturns: [...filteredAuto, ...manual] };
}

async function buildAttributedPortfolioChitSummaries(dbClient, orgId, { status, returnsMode = 'HYBRID', treasuryPolicy = 'PRO_RATA', chitIds = null } = {}) {
  const normalizedReturnsMode = normalizeReturnsMode(returnsMode);
  const normalizedTreasuryPolicy = normalizeTreasuryPolicy(treasuryPolicy);
  const { chits, receiptsByChit, paymentsByChit, allocationsByChit, returnsByChit } = await getPortfolioChitData(dbClient, orgId, { status, chitIds });
  if (!chits.length) {
    return {
      chits,
      chitSummaries: [],
      receiptsByChit, paymentsByChit, allocationsByChit, returnsByChit,
      attributionMeta: { returnsMode: normalizedReturnsMode, treasuryPolicy: normalizedTreasuryPolicy },
    };
  }

  const allLinkedLoanIds = Array.from(new Set(
    chits.flatMap((c) => extractLinkedLoanIdsFromAllocations(allocationsByChit.get(c.id) || [])),
  ));
  const { loansById, collectionsByLoan } = await fetchLoanAttributionInputs(dbClient, orgId, allLinkedLoanIds);

  const exactByChit = new Map();
  const exactConsumedByCollection = new Map();
  for (const c of chits) {
    const allocations = allocationsByChit.get(c.id) || [];
    const manualReturns = returnsByChit.get(c.id) || [];
    const exact = buildEffectiveReturnsForChit({
      chit: c,
      allocations,
      manualReturns,
      returnsMode: 'AUTO',
      loansById,
      collectionsByLoan,
    });
    exactByChit.set(c.id, exact);
    for (const r of exact.autoDerivedReturns || []) {
      const cid = r.linked_collection_id || r.linkedCollectionId;
      if (!cid) continue;
      const prev = exactConsumedByCollection.get(cid) || { principal: 0, interest: 0 };
      prev.principal += toAmount(r.amount_returned);
      prev.interest += toAmount(r.interest_income_amount);
      exactConsumedByCollection.set(cid, prev);
    }
  }

  const allCollections = await fetchAllCollectionsForTreasuryAttribution(dbClient, orgId);
  const residualCollections = [];
  for (const row of allCollections) {
    if (row.is_writeoff) continue;
    const split = calcCollectionSplitForAttribution(row, row);
    const consumed = exactConsumedByCollection.get(row.id) || { principal: 0, interest: 0 };
    const principalResidual = Math.max(0, Number((split.principal - toAmount(consumed.principal)).toFixed(2)));
    const interestResidual = Math.max(0, Number((split.interest - toAmount(consumed.interest)).toFixed(2)));
    if (principalResidual <= 0 && interestResidual <= 0) continue;
    residualCollections.push({
      collectionId: row.id,
      date: row.collection_date,
      principalResidual,
      interestResidual,
    });
  }

  const treasuryAllocations = chits.flatMap((c) => (allocationsByChit.get(c.id) || [])
    .filter((a) => String(a.purpose || '').toUpperCase() === 'LENDING' && !(a.linked_loan_id || a.linkedLoanId))
    .map((a) => ({ ...a, chitId: c.id })));
  const treasuryPool = buildTreasuryPoolAttributedReturns({
    treasuryAllocations,
    residualCollections,
    policy: normalizedTreasuryPolicy,
  });

  const chitSummaries = chits.map((c) => {
    const allocations = allocationsByChit.get(c.id) || [];
    const manualReturns = returnsByChit.get(c.id) || [];
    const exact = exactByChit.get(c.id) || { autoDerivedReturns: [], attribution: { warnings: [] } };
    const treasuryAuto = treasuryPool.autoReturnsByChit.get(c.id) || [];
    const combined = combineAutoAndManualReturns({
      autoReturns: [...(exact.autoDerivedReturns || []), ...treasuryAuto],
      manualReturns,
      returnsMode: normalizedReturnsMode,
    });
    combined.effectiveReturns.sort((a, b) => new Date(a.return_date || a.returnDate) - new Date(b.return_date || b.returnDate));

    const summary = summarizeChit({
      chit: c,
      receipt: receiptsByChit.get(c.id) || null,
      payments: paymentsByChit.get(c.id) || [],
      allocations,
      returns: combined.effectiveReturns,
    });

    const treasuryMetrics = treasuryPool.metricsByChit.get(c.id) || {
      treasuryPolicy: normalizedTreasuryPolicy,
      treasuryAllocationAmount: 0,
      treasuryAutoCapitalReturned: 0,
      treasuryAutoInterestIncome: 0,
      treasuryUnrecoveredBalance: 0,
      warnings: [],
    };

    const nonLoanAllocationAmount = allocations
      .filter((a) => String(a.purpose || '').toUpperCase() !== 'LENDING')
      .reduce((s, a) => s + toAmount(a.amount_allocated ?? a.amountAllocated), 0);

    return {
      ...summary,
      returnsMode: combined.returnsMode,
      attribution: {
        ...(exact.attribution || {}),
        treasuryPolicy: normalizedTreasuryPolicy,
        treasuryAllocationAmount: toAmount(treasuryMetrics.treasuryAllocationAmount),
        treasuryAutoCapitalReturned: toAmount(treasuryMetrics.treasuryAutoCapitalReturned),
        treasuryAutoInterestIncome: toAmount(treasuryMetrics.treasuryAutoInterestIncome),
        treasuryUnrecoveredBalance: toAmount(treasuryMetrics.treasuryUnrecoveredBalance),
        nonLoanAllocationAmount: Number((toAmount(exact.attribution?.nonLoanAllocationAmount) + nonLoanAllocationAmount).toFixed(2)),
        warnings: [
          ...(exact.attribution?.warnings || []),
          ...(toAmount(treasuryMetrics.treasuryAllocationAmount) > 0 ? [
            `Treasury pool auto-attribution (${normalizedTreasuryPolicy}) assumes residual business collections can be economically attributed to unlinked lending allocations.`,
          ] : []),
          ...(nonLoanAllocationAmount > 0 ? [
            'Non-lending allocations still require manual/override treatment (treasury engine currently covers unlinked lending allocations only).',
          ] : []),
        ],
        manualOverrideCount: manualReturns.length,
        effectiveReturnRowsCount: combined.effectiveReturns.length,
        autoDerivedReturnRowsCount: (exact.autoDerivedReturns || []).length + treasuryAuto.length,
      },
    };
  });

  return {
    chits,
    chitSummaries,
    receiptsByChit, paymentsByChit, allocationsByChit, returnsByChit,
    attributionMeta: {
      returnsMode: normalizedReturnsMode,
      treasuryPolicy: normalizedTreasuryPolicy,
      residualCollectionsCount: residualCollections.length,
      treasuryPoolAllocationsCount: treasuryAllocations.length,
    },
  };
}

async function buildChitSummarySnapshot(dbClient, orgId, chitId, { returnsMode = 'HYBRID' } = {}) {
  const [chit, receipt, payments, allocations, returns] = await Promise.all([
    getChitOrThrow(dbClient, orgId, chitId),
    getChitReceipt(dbClient, orgId, chitId),
    getChitPayments(dbClient, orgId, chitId),
    getChitAllocations(dbClient, orgId, chitId),
    getChitReturns(dbClient, orgId, chitId),
  ]);
  const linkedLoanIds = extractLinkedLoanIdsFromAllocations(allocations);
  const { loansById, collectionsByLoan } = await fetchLoanAttributionInputs(dbClient, orgId, linkedLoanIds);
  const effective = buildEffectiveReturnsForChit({
    chit,
    allocations,
    manualReturns: returns,
    returnsMode,
    loansById,
    collectionsByLoan,
  });
  const summary = summarizeChit({ chit, receipt, payments, allocations, returns: effective.effectiveReturns });
  return {
    ...summary,
    returnsMode: effective.returnsMode,
    attribution: {
      ...effective.attribution,
      manualOverrideCount: returns.length,
      effectiveReturnRowsCount: effective.effectiveReturns.length,
      autoDerivedReturnRowsCount: effective.autoDerivedReturns.length,
    },
  };
}

async function buildChitSummarySnapshotWithPortfolioAttribution(dbClient, orgId, chitId, { returnsMode = 'HYBRID', treasuryPolicy = 'PRO_RATA' } = {}) {
  await getChitOrThrow(dbClient, orgId, chitId);
  const ctx = await buildAttributedPortfolioChitSummaries(dbClient, orgId, { returnsMode, treasuryPolicy });
  const summary = ctx.chitSummaries.find((c) => c.chitId === chitId);
  if (!summary) throw new ApiError(404, 'CHIT_NOT_FOUND', 'Chit not found');
  return summary;
}

async function getAvailableChitBalance(dbClient, orgId, chitId) {
  const [receiptRes, allocRes, retRes] = await Promise.all([
    query(`select coalesce(amount_received,0) as amount_received from chit_receipts where organization_id=$1 and chit_id=$2`, [orgId, chitId], dbClient),
    query(`select coalesce(sum(amount_allocated),0) as allocated from fund_source_allocations where organization_id=$1 and source_type='CHIT' and chit_id=$2`, [orgId, chitId], dbClient),
    query(`select coalesce(sum(amount_returned),0) as returned_capital from chit_capital_returns where organization_id=$1 and chit_id=$2`, [orgId, chitId], dbClient),
  ]);
  const received = toAmount(receiptRes.rows[0]?.amount_received);
  const allocated = toAmount(allocRes.rows[0]?.allocated);
  const returnedCapital = toAmount(retRes.rows[0]?.returned_capital);
  return received - allocated + returnedCapital;
}

async function getPortfolioChitData(dbClient, orgId, { status, chitIds = null } = {}) {
  const params = [orgId];
  const where = ['c.organization_id = $1'];
  if (status) {
    params.push(String(status).toUpperCase());
    where.push(`c.status = $${params.length}`);
  }
  if (Array.isArray(chitIds) && chitIds.length) {
    params.push(chitIds);
    where.push(`c.id = any($${params.length}::uuid[])`);
  }
  const chitsRes = await query(`select * from chits c where ${where.join(' and ')} order by c.start_date asc, c.created_at asc`, params, dbClient);
  const chits = chitsRes.rows;
  if (!chits.length) return { chits: [], receiptsByChit: new Map(), paymentsByChit: new Map(), allocationsByChit: new Map(), returnsByChit: new Map() };
  const ids = chits.map((c) => c.id);
  const [receiptsRes, paymentsRes, allocationsRes, returnsRes] = await Promise.all([
    query(`select * from chit_receipts where organization_id=$1 and chit_id = any($2::uuid[])`, [orgId, ids], dbClient),
    query(`select * from chit_installment_payments where organization_id=$1 and chit_id = any($2::uuid[]) order by payment_date asc`, [orgId, ids], dbClient),
    query(`select * from fund_source_allocations where organization_id=$1 and source_type='CHIT' and chit_id = any($2::uuid[]) order by allocation_date asc`, [orgId, ids], dbClient),
    query(`select * from chit_capital_returns where organization_id=$1 and chit_id = any($2::uuid[]) order by return_date asc`, [orgId, ids], dbClient),
  ]);

  const group = (rows, key) => {
    const m = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return m;
  };

  return {
    chits,
    receiptsByChit: new Map(receiptsRes.rows.map((r) => [r.chit_id, r])),
    paymentsByChit: group(paymentsRes.rows, 'chit_id'),
    allocationsByChit: group(allocationsRes.rows, 'chit_id'),
    returnsByChit: group(returnsRes.rows, 'chit_id'),
  };
}

function mapChitRow(row) {
  return {
    id: row.id,
    chitCode: row.chit_code,
    chitName: row.chit_name,
    groupName: row.group_name,
    organizer: row.organizer,
    faceValue: toAmount(row.face_value),
    tenureMonths: Number(row.tenure_months || 0),
    installmentAmount: toAmount(row.installment_amount),
    startDate: ymd(row.start_date),
    expectedEndDate: ymd(row.expected_end_date),
    drawType: row.draw_type,
    drawDate: ymd(row.draw_date),
    amountReceived: toAmount(row.amount_received),
    discountAmount: toAmount(row.discount_amount),
    commissionAmount: toAmount(row.commission_amount),
    otherCharges: toAmount(row.other_charges),
    feesPaidSeparately: !!row.fees_paid_separately,
    bankAccountRef: row.bank_account_ref,
    accountingTreatmentMode: row.accounting_treatment_mode,
    status: row.status,
    overdraftAllowed: !!row.overdraft_allowed,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['c.organization_id = $1'];

  if (req.query.status) {
    params.push(String(req.query.status).toUpperCase());
    where.push(`c.status = $${params.length}`);
  }
  if (req.query.organizer) {
    params.push(String(req.query.organizer));
    where.push(`c.organizer = $${params.length}`);
  }
  if (req.query.fromDate) {
    params.push(String(req.query.fromDate));
    where.push(`c.start_date >= $${params.length}::date`);
  }
  if (req.query.toDate) {
    params.push(String(req.query.toDate));
    where.push(`c.start_date <= $${params.length}::date`);
  }
  if (req.query.q) {
    params.push(`%${String(req.query.q).trim()}%`);
    where.push(`(c.chit_name ilike $${params.length} or coalesce(c.group_name,'') ilike $${params.length} or coalesce(c.organizer,'') ilike $${params.length})`);
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    with base as (
      select
        c.*,
        coalesce(sum(cp.amount_paid),0) as total_paid,
        coalesce(sum(ci.expected_amount - ci.paid_amount) filter (where ci.status in ('UNPAID','PARTIAL')),0) as remaining_due,
        coalesce(cr.amount_received,0) - coalesce((select sum(a.amount_allocated) from fund_source_allocations a where a.organization_id=c.organization_id and a.source_type='CHIT' and a.chit_id=c.id),0)
          + coalesce((select sum(r.amount_returned) from chit_capital_returns r where r.organization_id=c.organization_id and r.chit_id=c.id),0) as available_chit_balance,
        count(*) over()::int as total_count
      from chits c
      left join chit_installment_payments cp on cp.chit_id = c.id and cp.organization_id = c.organization_id
      left join chit_installments ci on ci.chit_id = c.id and ci.organization_id = c.organization_id
      left join chit_receipts cr on cr.chit_id = c.id and cr.organization_id = c.organization_id
      where ${where.join(' and ')}
      group by c.id, cr.amount_received
    )
    select * from base
    order by start_date desc, created_at desc
    limit $${limitIdx} offset $${offsetIdx}
  `;

  const result = await query(sql, params);
  const items = result.rows.map((r) => ({
    ...mapChitRow(r),
    totalPaid: toAmount(r.total_paid),
    remainingDue: toAmount(r.remaining_due),
    availableChitBalance: toAmount(r.available_chit_balance),
    utilizationPct: toAmount(r.amount_received) > 0 ? ((toAmount(r.amount_received) - Math.max(0, toAmount(r.available_chit_balance))) / toAmount(r.amount_received)) * 100 : 0,
  }));

  res.json({ items, page, pageSize, total: result.rows[0]?.total_count || 0 });
}));

router.post('/', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};

  const chitName = String(body.chitName || '').trim();
  const groupName = body.groupName == null ? null : String(body.groupName).trim() || null;
  const organizer = body.organizer == null ? null : String(body.organizer).trim() || null;
  const faceValue = toAmount(body.faceValue);
  const tenureMonths = parseInt(body.tenureMonths, 10);
  const installmentAmount = toAmount(body.installmentAmount);
  const startDate = asDateOnly(body.startDate, 'startDate');
  const drawType = String(body.drawType || '').trim().toUpperCase();
  const bankAccountRef = body.bankAccountRef == null ? null : String(body.bankAccountRef).trim() || null;
  const accountingTreatmentMode = String(body.accountingTreatmentMode || 'FINANCING').trim().toUpperCase();
  const notes = body.notes == null ? null : String(body.notes);
  const chitCode = String(body.chitCode || generateChitCode()).trim();
  const overdraftAllowed = parseBool(body.overdraftAllowed, false);

  if (!chitName) throw new ApiError(422, 'VALIDATION_ERROR', 'chitName is required');
  if (!(faceValue > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'faceValue must be > 0');
  if (!(tenureMonths > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'tenureMonths must be > 0');
  if (!(installmentAmount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'installmentAmount must be > 0');
  if (!['AUCTION', 'LOTTERY', 'FIXED'].includes(drawType)) throw new ApiError(422, 'VALIDATION_ERROR', 'drawType must be AUCTION/LOTTERY/FIXED');
  if (!['FINANCING', 'SAVING_ASSET'].includes(accountingTreatmentMode)) throw new ApiError(422, 'VALIDATION_ERROR', 'accountingTreatmentMode must be FINANCING/SAVING_ASSET');

  const expectedEndDate = addMonthsPreserveDay(startDate, tenureMonths - 1);
  const schedule = buildInstallmentSchedule({ startDate, tenureMonths, installmentAmount });

  const out = await withTransaction(async (dbClient) => {
    const insert = await query(
      `
      insert into chits (
        organization_id, chit_code, chit_name, group_name, organizer,
        face_value, tenure_months, installment_amount,
        start_date, expected_end_date, draw_type,
        bank_account_ref, accounting_treatment_mode, status,
        overdraft_allowed, notes, created_by, updated_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'RUNNING',$14,$15,$16,$17)
      returning *
      `,
      [orgId, chitCode, chitName, groupName, organizer, faceValue, tenureMonths, installmentAmount, startDate, expectedEndDate, drawType, bankAccountRef, accountingTreatmentMode, overdraftAllowed, notes, userId, userId],
      dbClient,
    );
    const chit = insert.rows[0];

    const scheduleRows = [];
    for (const s of schedule) {
      const row = await query(
        `
        insert into chit_installments (
          organization_id, chit_id, installment_no, due_date, expected_amount, paid_amount, status
        ) values ($1,$2,$3,$4,$5,0,'UNPAID')
        returning *
        `,
        [orgId, chit.id, s.installmentNo, s.dueDate, s.expectedAmount],
        dbClient,
      );
      scheduleRows.push(row.rows[0]);
    }

    await insertAuditLog(dbClient, {
      orgId,
      userId,
      entityType: 'CHIT_REGISTER',
      entityId: chit.id,
      action: 'CREATE',
      afterData: { chitCode, chitName, faceValue, tenureMonths, installmentAmount, drawType, accountingTreatmentMode },
    });

    return { chit, scheduleRows };
  });

  res.status(201).json({
    item: mapChitRow(out.chit),
    schedule: out.scheduleRows.map((r) => ({ id: r.id, installmentNo: r.installment_no, dueDate: r.due_date, expectedAmount: toAmount(r.expected_amount), paidAmount: toAmount(r.paid_amount), status: r.status })),
    journalPreview: [],
  });
}));

router.get('/portfolio/summary', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  const returnsMode = normalizeReturnsMode(req.query.returnsMode);
  const treasuryPolicy = normalizeTreasuryPolicy(req.query.treasuryPolicy);
  const scenario = {
    reduceInflowsPct: req.query.reduceInflowsPct == null ? 20 : Number(req.query.reduceInflowsPct),
    delayCollectionsDays: req.query.delayCollectionsDays == null ? 60 : Number(req.query.delayCollectionsDays),
    increaseDefaultsPct: req.query.increaseDefaultsPct == null ? 10 : Number(req.query.increaseDefaultsPct),
  };
  const otherFixedOutflowsMonthly = req.query.otherFixedOutflowsMonthly == null ? 0 : toAmount(req.query.otherFixedOutflowsMonthly);
  const fromMonth = req.query.fromMonth ? String(req.query.fromMonth) : null;
  const toMonth = req.query.toMonth ? String(req.query.toMonth) : null;

  const attributed = await buildAttributedPortfolioChitSummaries(null, orgId, { status, returnsMode, treasuryPolicy });
  const chitSummaries = attributed.chitSummaries;

  const monthFilter = fromMonth && toMonth ? [monthBounds(fromMonth), monthBounds(toMonth)] : null;
  let dueWhere = '';
  let inflowWhere = '';
  const dueParams = [orgId];
  const inflowParams = [orgId];
  if (monthFilter) {
    const start = monthFilter[0].start;
    const end = monthFilter[1].end;
    dueParams.push(start, end);
    inflowParams.push(start, end);
    dueWhere = ` and ci.due_date >= $2::date and ci.due_date < $3::date`;
    inflowWhere = ` and le.entry_time >= $2 and le.entry_time < $3`;
  }

  const [monthlyDueRes, monthlyInflowsRes, auditRes] = await Promise.all([
    query(
      `
      select to_char(ci.due_date, 'YYYY-MM') as month, coalesce(sum(ci.expected_amount),0) as total_chit_installments_due
      from chit_installments ci
      join chits c on c.id = ci.chit_id and c.organization_id = ci.organization_id
      where ci.organization_id = $1 and c.status in ('RUNNING','CLOSED') ${dueWhere}
      group by 1
      order by 1
      `,
      dueParams,
    ),
    query(
      `
      select to_char(le.entry_time at time zone 'UTC', 'YYYY-MM') as month, coalesce(sum(le.amount),0) as business_cash_inflows
      from ledger_entries le
      where le.organization_id = $1 and le.tx_type='CREDIT' and le.tag='COLLECTION' ${inflowWhere}
      group by 1
      order by 1
      `,
      inflowParams,
    ),
    query(
      `
      select id, entity_type as "entityType", entity_id as "entityId", action, created_at as "createdAt", actor_user_id as "actorUserId"
      from audit_logs
      where organization_id = $1 and entity_type in ('CHIT_REGISTER','CHIT_INSTALLMENT_PAYMENT','CHIT_RECEIPT','CHIT_ALLOCATION','CHIT_CAPITAL_RETURN')
      order by created_at desc
      limit 200
      `,
      [orgId],
    ),
  ]);

  const payload = summarizePortfolio({
    chitSummaries,
    monthlyInstallmentsDue: monthlyDueRes.rows.map((r) => ({ month: r.month, totalChitInstallmentsDue: toAmount(r.total_chit_installments_due) })),
    monthlyBusinessInflows: monthlyInflowsRes.rows.map((r) => ({ month: r.month, businessCashInflows: toAmount(r.business_cash_inflows) })),
    otherFixedOutflowsMonthly,
    scenario,
    auditLog: auditRes.rows,
  });
  payload.portfolio_summary.attributionMode = returnsMode;
  payload.portfolio_summary.treasuryPolicy = treasuryPolicy;
  payload.portfolio_summary.autoAttribution = {
    chitsWithWarnings: chitSummaries.filter((c) => (c.attribution?.warnings || []).length > 0).length,
    totalLinkedLendingAllocationAmount: chitSummaries.reduce((s, c) => s + toAmount(c.attribution?.linkedLendingAllocationAmount), 0),
    totalNonLoanAllocationAmount: chitSummaries.reduce((s, c) => s + toAmount(c.attribution?.nonLoanAllocationAmount), 0),
    autoDerivedCapitalReturned: chitSummaries.reduce((s, c) => s + toAmount(c.attribution?.autoDerivedCapitalReturned), 0),
    autoDerivedInterestIncome: chitSummaries.reduce((s, c) => s + toAmount(c.attribution?.autoDerivedInterestIncome), 0),
  };
  payload.portfolio_summary.autoAttribution.residualCollectionsCount = attributed.attributionMeta?.residualCollectionsCount || 0;
  payload.portfolio_summary.autoAttribution.treasuryPoolAllocationsCount = attributed.attributionMeta?.treasuryPoolAllocationsCount || 0;

  res.json(payload);
}));

router.get('/:chitId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  const [chit, receipt, scheduleRes] = await Promise.all([
    getChitOrThrow(null, orgId, chitId),
    getChitReceipt(null, orgId, chitId),
    query(
      `
      select
        count(*)::int as installment_count,
        coalesce(sum(expected_amount),0) as total_due,
        coalesce(sum(paid_amount),0) as total_paid,
        count(*) filter (where status in ('UNPAID','PARTIAL'))::int as open_installments,
        count(*) filter (where status in ('UNPAID','PARTIAL') and due_date < current_date)::int as overdue_installments,
        coalesce(sum(case when status in ('UNPAID','PARTIAL') then (expected_amount - paid_amount) else 0 end),0) as remaining_due
      from chit_installments where organization_id = $1 and chit_id = $2
      `,
      [orgId, chitId],
    ),
  ]);
  const summary = await buildChitSummarySnapshotWithPortfolioAttribution(null, orgId, chitId, {
    returnsMode: normalizeReturnsMode(req.query.returnsMode),
    treasuryPolicy: normalizeTreasuryPolicy(req.query.treasuryPolicy),
  });
  const stats = scheduleRes.rows[0] || {};
  res.json({
    item: mapChitRow(chit),
    receipt: receipt ? {
      id: receipt.id,
      drawDate: receipt.draw_date,
      amountReceived: toAmount(receipt.amount_received),
      discountAmount: toAmount(receipt.discount_amount),
      commissionAmount: toAmount(receipt.commission_amount),
      otherCharges: toAmount(receipt.other_charges),
      feesPaidSeparately: !!receipt.fees_paid_separately,
      receiptMode: receipt.receipt_mode,
      reference: receipt.reference,
      notes: receipt.notes,
    } : null,
    stats: {
      installmentCount: Number(stats.installment_count || 0),
      totalDue: toAmount(stats.total_due),
      totalPaid: toAmount(stats.total_paid),
      remainingDue: toAmount(stats.remaining_due),
      openInstallments: Number(stats.open_installments || 0),
      overdueInstallments: Number(stats.overdue_installments || 0),
      availableChitBalance: summary.yield.idleBalance,
    },
    roiSnapshot: {
      chit_summary: (() => { const { cashflowSeries, ...rest } = summary; return rest; })(),
      cashflow_series_per_chit: summary.cashflowSeries,
    },
  });
}));

router.patch('/:chitId', requireRoles('OWNER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const body = req.body || {};

  const allowed = {
    chitName: ['chit_name', (v) => String(v).trim()],
    groupName: ['group_name', (v) => (v == null ? null : String(v).trim() || null)],
    organizer: ['organizer', (v) => (v == null ? null : String(v).trim() || null)],
    bankAccountRef: ['bank_account_ref', (v) => (v == null ? null : String(v).trim() || null)],
    notes: ['notes', (v) => (v == null ? null : String(v))],
    status: ['status', (v) => String(v).toUpperCase()],
    accountingTreatmentMode: ['accounting_treatment_mode', (v) => String(v).toUpperCase()],
    overdraftAllowed: ['overdraft_allowed', (v) => parseBool(v, false)],
  };

  const out = await withTransaction(async (dbClient) => {
    const before = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    const sets = [];
    const params = [orgId, chitId];
    Object.entries(allowed).forEach(([k, [col, map]]) => {
      if (body[k] === undefined) return;
      let v = map(body[k]);
      if (col === 'status' && !['RUNNING', 'CLOSED', 'CANCELLED'].includes(v)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid status');
      if (col === 'accounting_treatment_mode' && !['FINANCING', 'SAVING_ASSET'].includes(v)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid accountingTreatmentMode');
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    });
    if (!sets.length) throw new ApiError(422, 'VALIDATION_ERROR', 'No valid fields to update');
    params.push(userId);
    sets.push(`updated_by = $${params.length}`, 'updated_at = now()', 'version = version + 1');

    const upd = await query(
      `update chits set ${sets.join(', ')} where organization_id = $1 and id = $2 returning *`,
      params,
      dbClient,
    );
    const row = upd.rows[0];
    await insertAuditLog(dbClient, {
      orgId,
      userId,
      entityType: 'CHIT_REGISTER',
      entityId: chitId,
      action: 'UPDATE',
      beforeData: before,
      afterData: row,
    });
    return row;
  });

  res.json({ item: mapChitRow(out) });
}));

router.delete('/:chitId', requireRoles('OWNER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const reason = String((req.body || {}).reason || 'Manual cancel').trim();

  const row = await withTransaction(async (dbClient) => {
    const before = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    const upd = await query(
      `update chits set status='CANCELLED', notes = coalesce(notes,'') || case when coalesce(notes,'')='' then '' else E'\n' end || $3, updated_by=$4, updated_at=now(), version=version+1 where organization_id=$1 and id=$2 returning *`,
      [orgId, chitId, `[Cancelled] ${reason}`, userId],
      dbClient,
    );
    await insertAuditLog(dbClient, { orgId, userId, entityType: 'CHIT_REGISTER', entityId: chitId, action: 'CANCEL', beforeData: before, afterData: upd.rows[0], metadata: { reason } });
    return upd.rows[0];
  });

  res.json({ item: mapChitRow(row) });
}));

router.get('/:chitId/installments', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const rows = await query(
    `
    select ci.*,
      coalesce(json_agg(json_build_object(
        'id', cp.id,
        'paymentDate', cp.payment_date,
        'amountPaid', cp.amount_paid,
        'mode', cp.mode,
        'reference', cp.reference,
        'narration', cp.narration,
        'linkedBankEntryId', cp.linked_bank_ledger_entry_id
      ) order by cp.payment_date asc) filter (where cp.id is not null), '[]'::json) as payments
    from chit_installments ci
    left join chit_installment_payments cp on cp.chit_installment_id = ci.id and cp.organization_id = ci.organization_id
    where ci.organization_id = $1 and ci.chit_id = $2
    group by ci.id
    order by ci.installment_no asc
    `,
    [orgId, chitId],
  );

  const today = new Date().toISOString().slice(0, 10);
  res.json({
    items: rows.rows.map((r) => {
      const expectedAmount = toAmount(r.expected_amount);
      const paidAmount = toAmount(r.paid_amount);
      const dueDate = ymd(r.due_date);
      const overdueDays = (r.status !== 'PAID' && dueDate && dueDate < today)
        ? Math.floor((new Date(`${today}T00:00:00Z`) - new Date(`${dueDate}T00:00:00Z`)) / DAY_MS)
        : 0;
      return {
        id: r.id,
        installmentNo: Number(r.installment_no),
        dueDate,
        expectedAmount,
        paidAmount,
        reconciliationStatus: r.status,
        overdueDays,
        variance: Number((expectedAmount - paidAmount).toFixed(2)),
        payments: Array.isArray(r.payments) ? r.payments : [],
      };
    }),
  });
}));

router.post('/:chitId/payments', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const body = req.body || {};
  const chitInstallmentId = String(body.chitInstallmentId || '').trim();
  const amountPaid = toAmount(body.amountPaid);
  const paymentDate = body.paymentDate ? asDate(body.paymentDate, 'paymentDate').toISOString() : new Date().toISOString();
  const mode = String(body.mode || 'BANK').trim().toUpperCase();
  const reference = body.reference == null ? null : String(body.reference);
  const narration = body.narration == null ? null : String(body.narration);
  const linkedBankEntryId = body.linkedBankEntryId || null;
  const allowAdvance = parseBool(body.allowAdvance, false);

  if (!chitInstallmentId) throw new ApiError(422, 'VALIDATION_ERROR', 'chitInstallmentId is required');
  if (!(amountPaid > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amountPaid must be > 0');

  const out = await withTransaction(async (dbClient) => {
    const chit = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    const instRes = await query(`select * from chit_installments where organization_id=$1 and chit_id=$2 and id=$3 for update`, [orgId, chitId, chitInstallmentId], dbClient);
    const inst = instRes.rows[0];
    if (!inst) throw new ApiError(404, 'INSTALLMENT_NOT_FOUND', 'Chit installment not found');

    const expected = toAmount(inst.expected_amount);
    const currentPaid = toAmount(inst.paid_amount);
    const nextPaid = currentPaid + amountPaid;
    if (!allowAdvance && nextPaid > (expected + 0.0001)) {
      throw new ApiError(422, 'PAYMENT_EXCEEDS_DUE', 'Payment exceeds installment due. Pass allowAdvance=true to allow.');
    }

    const paymentInsert = await query(
      `
      insert into chit_installment_payments (
        organization_id, chit_id, chit_installment_id, payment_date, amount_paid, mode, reference, narration, linked_bank_ledger_entry_id, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning *
      `,
      [orgId, chitId, chitInstallmentId, paymentDate, amountPaid, mode, reference, narration, linkedBankEntryId, userId],
      dbClient,
    );
    const payment = paymentInsert.rows[0];

    const nextStatus = nextPaid <= 0 ? 'UNPAID' : nextPaid + 0.0001 >= expected ? 'PAID' : 'PARTIAL';
    const instUpd = await query(
      `
      update chit_installments
      set paid_amount = $4, status = $5, last_payment_date = $6, updated_at = now()
      where organization_id=$1 and chit_id=$2 and id=$3
      returning *
      `,
      [orgId, chitId, chitInstallmentId, nextPaid, nextStatus, paymentDate],
      dbClient,
    );
    const updatedInstallment = instUpd.rows[0];

    const ledgerEntry = await insertMirrorLedgerEntry(dbClient, {
      orgId,
      userId,
      txType: 'DEBIT',
      amount: amountPaid,
      description: `Chit Installment Paid — ${chit.chit_name} #${inst.installment_no}`,
      entryTime: paymentDate,
      category: 'CHIT_INSTALLMENT',
      chitId,
    });

    const accounts = chitJournalAccounts(chit.accounting_treatment_mode);
    const journal = await insertChitJournalLines(dbClient, {
      orgId,
      userId,
      chitId,
      sourceEventType: 'INSTALLMENT_PAYMENT',
      sourceEventId: payment.id,
      postingDate: paymentDate,
      lines: [
        { accountCode: accounts.chitAsset.code, accountName: accounts.chitAsset.name, drAmount: amountPaid, crAmount: 0, narration: `Chit installment payment ${inst.installment_no}` },
        { accountCode: accounts.bank.code, accountName: accounts.bank.name, drAmount: 0, crAmount: amountPaid, narration: `Bank/Cash payment for chit installment ${inst.installment_no}`, ledgerEntryId: ledgerEntry.id },
      ],
    });

    await insertAuditLog(dbClient, { orgId, userId, entityType: 'CHIT_INSTALLMENT_PAYMENT', entityId: payment.id, action: 'CREATE', afterData: { payment, updatedInstallment }, metadata: { chitId, installmentNo: inst.installment_no } });

    return { payment, updatedInstallment, journal, ledgerEntry };
  });

  res.status(201).json({
    payment: {
      id: out.payment.id,
      paymentDate: out.payment.payment_date,
      amountPaid: toAmount(out.payment.amount_paid),
      mode: out.payment.mode,
      reference: out.payment.reference,
      narration: out.payment.narration,
      linkedBankEntryId: out.payment.linked_bank_ledger_entry_id,
    },
    installment: {
      id: out.updatedInstallment.id,
      installmentNo: Number(out.updatedInstallment.installment_no),
      dueDate: ymd(out.updatedInstallment.due_date),
      expectedAmount: toAmount(out.updatedInstallment.expected_amount),
      paidAmount: toAmount(out.updatedInstallment.paid_amount),
      status: out.updatedInstallment.status,
    },
    journal: out.journal,
    ledgerEntry: out.ledgerEntry,
  });
}));

router.get('/:chitId/receipt', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const receipt = await getChitReceipt(null, orgId, chitId);
  if (!receipt) return res.json({ item: null });
  res.json({ item: {
    id: receipt.id,
    drawDate: receipt.draw_date,
    amountReceived: toAmount(receipt.amount_received),
    discountAmount: toAmount(receipt.discount_amount),
    commissionAmount: toAmount(receipt.commission_amount),
    otherCharges: toAmount(receipt.other_charges),
    feesPaidSeparately: !!receipt.fees_paid_separately,
    receiptMode: receipt.receipt_mode,
    reference: receipt.reference,
    linkedBankEntryId: receipt.linked_bank_ledger_entry_id,
    notes: receipt.notes,
  } });
}));

router.post('/:chitId/receipt', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const body = req.body || {};

  const drawDate = body.drawDate ? asDate(body.drawDate, 'drawDate').toISOString() : new Date().toISOString();
  const amountReceived = toAmount(body.amountReceived);
  const discountAmount = toAmount(body.discountAmount);
  const commissionAmount = toAmount(body.commissionAmount);
  const otherCharges = toAmount(body.otherCharges);
  const feesPaidSeparately = parseBool(body.feesPaidSeparately, false);
  const receiptMode = String(body.receiptMode || 'BANK').trim().toUpperCase();
  const reference = body.reference == null ? null : String(body.reference);
  const linkedBankEntryId = body.linkedBankEntryId || null;
  const notes = body.notes == null ? null : String(body.notes);

  if (!(amountReceived >= 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amountReceived is required');

  const out = await withTransaction(async (dbClient) => {
    const chit = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    if (amountReceived > toAmount(chit.face_value)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Amount_Received cannot exceed Face_Value');
    }

    const existing = await getChitReceipt(dbClient, orgId, chitId);
    let receipt;
    if (existing) {
      const upd = await query(
        `
        update chit_receipts
        set draw_date=$3, amount_received=$4, discount_amount=$5, commission_amount=$6, other_charges=$7,
            fees_paid_separately=$8, receipt_mode=$9, reference=$10, linked_bank_ledger_entry_id=$11, notes=$12, updated_at=now()
        where organization_id=$1 and chit_id=$2
        returning *
        `,
        [orgId, chitId, drawDate, amountReceived, discountAmount, commissionAmount, otherCharges, feesPaidSeparately, receiptMode, reference, linkedBankEntryId, notes],
        dbClient,
      );
      receipt = upd.rows[0];
    } else {
      const ins = await query(
        `
        insert into chit_receipts (
          organization_id, chit_id, draw_date, amount_received, discount_amount, commission_amount, other_charges,
          fees_paid_separately, receipt_mode, reference, linked_bank_ledger_entry_id, notes, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        returning *
        `,
        [orgId, chitId, drawDate, amountReceived, discountAmount, commissionAmount, otherCharges, feesPaidSeparately, receiptMode, reference, linkedBankEntryId, notes, userId],
        dbClient,
      );
      receipt = ins.rows[0];
    }

    await query(
      `
      update chits
      set draw_date = $3::date, amount_received=$4, discount_amount=$5, commission_amount=$6, other_charges=$7,
          fees_paid_separately=$8, updated_by=$9, updated_at=now(), version=version+1
      where organization_id=$1 and id=$2
      `,
      [orgId, chitId, drawDate, amountReceived, discountAmount, commissionAmount, otherCharges, feesPaidSeparately, userId],
      dbClient,
    );

    const ledgerEntry = await insertMirrorLedgerEntry(dbClient, {
      orgId,
      userId,
      txType: 'CREDIT',
      amount: amountReceived,
      description: `Chit Draw Receipt — ${chit.chit_name}`,
      entryTime: drawDate,
      category: 'CHIT_RECEIPT',
      chitId,
    });

    const accounts = chitJournalAccounts(chit.accounting_treatment_mode);
    const journalLines = [];
    journalLines.push({ accountCode: accounts.bank.code, accountName: accounts.bank.name, drAmount: amountReceived, crAmount: 0, narration: 'Chit draw receipt', ledgerEntryId: ledgerEntry.id });
    const costLineAmount = discountAmount + (feesPaidSeparately ? (commissionAmount + otherCharges) : 0);
    if (costLineAmount > 0) {
      journalLines.push({ accountCode: accounts.chitCost.code, accountName: accounts.chitCost.name, drAmount: costLineAmount, crAmount: 0, narration: 'Chit discount / fees cost' });
    }
    journalLines.push({ accountCode: accounts.chitAsset.code, accountName: accounts.chitAsset.name, drAmount: 0, crAmount: amountReceived + costLineAmount, narration: 'Chit facility settlement on draw' });

    const journal = await insertChitJournalLines(dbClient, {
      orgId,
      userId,
      chitId,
      sourceEventType: 'RECEIPT',
      sourceEventId: receipt.id,
      postingDate: drawDate,
      lines: journalLines,
    });

    await insertAuditLog(dbClient, { orgId, userId, entityType: 'CHIT_RECEIPT', entityId: receipt.id, action: existing ? 'UPDATE' : 'CREATE', afterData: receipt, metadata: { chitId } });

    return { receipt, journal, ledgerEntry };
  });

  res.status(201).json({ item: out.receipt, journal: out.journal, ledgerEntry: out.ledgerEntry });
}));

router.get('/:chitId/allocations', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const items = await getChitAllocations(null, orgId, chitId);
  const availableBalance = await getAvailableChitBalance(null, orgId, chitId);
  res.json({
    availableChitBalance: availableBalance,
    items: items.map((r) => ({
      id: r.id,
      allocationDate: r.allocation_date,
      amountAllocated: toAmount(r.amount_allocated),
      purpose: r.purpose,
      targetEntityType: r.target_entity_type,
      targetEntityId: r.target_entity_id,
      linkedLoanId: r.linked_loan_id,
      notes: r.notes,
      createdAt: r.created_at,
    })),
  });
}));

router.post('/:chitId/allocations', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const body = req.body || {};
  const allocationDate = body.allocationDate ? asDate(body.allocationDate, 'allocationDate').toISOString() : new Date().toISOString();
  const amountAllocated = toAmount(body.amountAllocated);
  const purpose = String(body.purpose || 'OTHER').trim().toUpperCase();
  const targetEntityType = body.targetEntityType == null ? null : String(body.targetEntityType).trim().toUpperCase() || null;
  const targetEntityId = body.targetEntityId == null ? null : String(body.targetEntityId).trim() || null;
  const linkedLoanId = body.linkedLoanId || null;
  const notes = body.notes == null ? null : String(body.notes);
  const allowOverdraft = parseBool(body.allowOverdraft, false);

  if (!(amountAllocated > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amountAllocated must be > 0');
  if (!['LENDING', 'INVENTORY', 'EXPENSES', 'ASSET', 'OTHER'].includes(purpose)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid purpose');
  }

  const out = await withTransaction(async (dbClient) => {
    const chit = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    const available = await getAvailableChitBalance(dbClient, orgId, chitId);
    if (!chit.overdraft_allowed && !allowOverdraft && amountAllocated > (available + 0.0001)) {
      throw new ApiError(422, 'ALLOCATION_EXCEEDS_AVAILABLE', 'Allocation cannot exceed available chit balance (overdraft not allowed)');
    }

    const ins = await query(
      `
      insert into fund_source_allocations (
        organization_id, source_type, chit_id, allocation_date, amount_allocated, purpose,
        target_entity_type, target_entity_id, linked_loan_id, notes, created_by
      ) values ($1,'CHIT',$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning *
      `,
      [orgId, chitId, allocationDate, amountAllocated, purpose, targetEntityType, targetEntityId, linkedLoanId, notes, userId],
      dbClient,
    );
    const allocation = ins.rows[0];

    const accounts = chitJournalAccounts(chit.accounting_treatment_mode);
    const journal = await insertChitJournalLines(dbClient, {
      orgId, userId, chitId,
      sourceEventType: 'ALLOCATION', sourceEventId: allocation.id, postingDate: allocationDate,
      lines: [
        { accountCode: accounts.allocation.code, accountName: accounts.allocation.name, drAmount: amountAllocated, crAmount: 0, narration: `Chit funds allocated for ${purpose}` },
        { accountCode: accounts.chitAsset.code, accountName: accounts.chitAsset.name, drAmount: 0, crAmount: amountAllocated, narration: 'Transfer from chit pool to deployment' },
      ],
    });

    await insertAuditLog(dbClient, { orgId, userId, entityType: 'CHIT_ALLOCATION', entityId: allocation.id, action: 'CREATE', afterData: allocation, metadata: { chitId } });

    const newAvailable = await getAvailableChitBalance(dbClient, orgId, chitId);
    return { allocation, journal, availableChitBalance: newAvailable };
  });

  res.status(201).json({ item: out.allocation, journal: out.journal, availableChitBalance: out.availableChitBalance });
}));

router.get('/:chitId/returns', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const rows = await getChitReturns(null, orgId, chitId);
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      allocationId: r.allocation_id,
      returnDate: r.return_date,
      amountReturned: toAmount(r.amount_returned),
      sourceType: r.source_type,
      linkedLoanId: r.linked_loan_id,
      linkedCollectionId: r.linked_collection_id,
      interestIncomeAmount: toAmount(r.interest_income_amount),
      otherIncomeAmount: toAmount(r.other_income_amount),
      notes: r.notes,
      createdAt: r.created_at,
    })),
  });
}));

router.post('/:chitId/returns', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { chitId } = req.params;
  const body = req.body || {};

  const allocationId = body.allocationId || null;
  const returnDate = body.returnDate ? asDate(body.returnDate, 'returnDate').toISOString() : new Date().toISOString();
  const amountReturned = toAmount(body.amountReturned);
  const sourceType = String(body.sourceType || 'OTHER').trim().toUpperCase();
  const linkedLoanId = body.linkedLoanId || null;
  const linkedCollectionId = body.linkedCollectionId || null;
  const interestIncomeAmount = toAmount(body.interestIncomeAmount);
  const otherIncomeAmount = toAmount(body.otherIncomeAmount);
  const notes = body.notes == null ? null : String(body.notes);

  if (!(amountReturned >= 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amountReturned must be >= 0');
  if (!(interestIncomeAmount >= 0 && otherIncomeAmount >= 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'income amounts must be >= 0');
  if (!['LOAN_PRINCIPAL_REPAYMENT', 'BUSINESS_SURPLUS', 'OTHER'].includes(sourceType)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid sourceType');
  if (!(amountReturned > 0 || interestIncomeAmount > 0 || otherIncomeAmount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'At least one amount must be > 0');

  const out = await withTransaction(async (dbClient) => {
    const chit = await getChitOrThrow(dbClient, orgId, chitId, { forUpdate: true });
    if (allocationId) {
      const alloc = await query(`select id from fund_source_allocations where organization_id=$1 and id=$2 and chit_id=$3 and source_type='CHIT'`, [orgId, allocationId, chitId], dbClient);
      if (!alloc.rows[0]) throw new ApiError(422, 'INVALID_ALLOCATION', 'allocationId not found for this chit');
    }

    const ins = await query(
      `
      insert into chit_capital_returns (
        organization_id, chit_id, allocation_id, return_date, amount_returned, source_type,
        linked_loan_id, linked_collection_id, interest_income_amount, other_income_amount, notes, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      returning *
      `,
      [orgId, chitId, allocationId, returnDate, amountReturned, sourceType, linkedLoanId, linkedCollectionId, interestIncomeAmount, otherIncomeAmount, notes, userId],
      dbClient,
    );
    const ret = ins.rows[0];

    const accounts = chitJournalAccounts(chit.accounting_treatment_mode);
    const journalLines = [];
    const totalIn = amountReturned + interestIncomeAmount + otherIncomeAmount;
    if (amountReturned > 0) {
      journalLines.push({ accountCode: accounts.chitAsset.code, accountName: accounts.chitAsset.name, drAmount: amountReturned, crAmount: 0, narration: 'Capital returned to chit pool' });
      journalLines.push({ accountCode: accounts.allocation.code, accountName: accounts.allocation.name, drAmount: 0, crAmount: amountReturned, narration: 'Reduce deployed chit funds' });
    }
    if (interestIncomeAmount + otherIncomeAmount > 0) {
      journalLines.push({ accountCode: accounts.chitAsset.code, accountName: accounts.chitAsset.name, drAmount: interestIncomeAmount + otherIncomeAmount, crAmount: 0, narration: 'Income attributable to chit-funded deployments' });
      journalLines.push({ accountCode: 'CHIT_YIELD', accountName: 'Chit-funded Yield Income', drAmount: 0, crAmount: interestIncomeAmount + otherIncomeAmount, narration: 'Attributed income from existing interest logic output' });
    }
    const journal = await insertChitJournalLines(dbClient, { orgId, userId, chitId, sourceEventType: 'RETURN', sourceEventId: ret.id, postingDate: returnDate, lines: journalLines });

    let ledgerEntry = null;
    if (totalIn > 0) {
      ledgerEntry = await insertMirrorLedgerEntry(dbClient, {
        orgId, userId, txType: 'CREDIT', amount: totalIn, description: `Chit capital return / yield — ${chit.chit_name}`, entryTime: returnDate, category: 'CHIT_RETURN', chitId,
      });
    }

    await insertAuditLog(dbClient, { orgId, userId, entityType: 'CHIT_CAPITAL_RETURN', entityId: ret.id, action: 'CREATE', afterData: ret, metadata: { chitId } });

    return { ret, journal, ledgerEntry, availableChitBalance: await getAvailableChitBalance(dbClient, orgId, chitId) };
  });

  res.status(201).json({ item: out.ret, journal: out.journal, ledgerEntry: out.ledgerEntry, availableChitBalance: out.availableChitBalance });
}));

router.get('/:chitId/roi', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  const returnsMode = normalizeReturnsMode(req.query.returnsMode);
  const treasuryPolicy = normalizeTreasuryPolicy(req.query.treasuryPolicy);
  const summary = await buildChitSummarySnapshotWithPortfolioAttribution(null, orgId, chitId, { returnsMode, treasuryPolicy });
  const { cashflowSeries, ...rest } = summary;
  res.json({
    returnsMode,
    treasuryPolicy,
    chit_summary: rest,
    cashflow_series_per_chit: cashflowSeries,
  });
}));

router.get('/:chitId/stress', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);

  const scenario = {
    reduceInflowsPct: req.query.reduceInflowsPct == null ? 20 : Number(req.query.reduceInflowsPct),
    delayCollectionsDays: req.query.delayCollectionsDays == null ? 60 : Number(req.query.delayCollectionsDays),
    increaseDefaultsPct: req.query.increaseDefaultsPct == null ? 10 : Number(req.query.increaseDefaultsPct),
  };
  const otherFixedOutflowsMonthly = req.query.otherFixedOutflowsMonthly == null ? 0 : toAmount(req.query.otherFixedOutflowsMonthly);

  const [monthlyDueRes, monthlyInflowsRes, summary] = await Promise.all([
    query(
      `
      select to_char(ci.due_date, 'YYYY-MM') as month, coalesce(sum(ci.expected_amount),0) as total_chit_installments_due
      from chit_installments ci
      where ci.organization_id = $1 and ci.chit_id = $2
      group by 1 order by 1
      `,
      [orgId, chitId],
    ),
    query(
      `
      select to_char(le.entry_time at time zone 'UTC', 'YYYY-MM') as month, coalesce(sum(le.amount),0) as business_cash_inflows
      from ledger_entries le
      where le.organization_id = $1 and le.tx_type='CREDIT' and le.tag='COLLECTION'
      group by 1 order by 1
      `,
      [orgId],
    ),
    buildChitSummarySnapshotWithPortfolioAttribution(null, orgId, chitId, {
      returnsMode: normalizeReturnsMode(req.query.returnsMode),
      treasuryPolicy: normalizeTreasuryPolicy(req.query.treasuryPolicy),
    }),
  ]);

  const payload = summarizePortfolio({
    chitSummaries: [summary],
    monthlyInstallmentsDue: monthlyDueRes.rows.map((r) => ({ month: r.month, totalChitInstallmentsDue: toAmount(r.total_chit_installments_due) })),
    monthlyBusinessInflows: monthlyInflowsRes.rows.map((r) => ({ month: r.month, businessCashInflows: toAmount(r.business_cash_inflows) })),
    otherFixedOutflowsMonthly,
    scenario,
    auditLog: [],
  });

  res.json({ stress_table_monthly: payload.stress_table_monthly, portfolio_summary: payload.portfolio_summary });
}));

router.get('/:chitId/journal', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const rows = await query(
    `
    select * from chit_journal_entries
    where organization_id=$1 and chit_id=$2
    order by posting_date desc, source_event_type asc, line_no asc
    `,
    [orgId, chitId],
  );
  res.json({ items: rows.rows });
}));

router.get('/:chitId/audit', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { chitId } = req.params;
  await getChitOrThrow(null, orgId, chitId);
  const rows = await query(
    `
    select id, entity_type as "entityType", entity_id as "entityId", action, before_data as "beforeData", after_data as "afterData", metadata, actor_user_id as "actorUserId", created_at as "createdAt"
    from audit_logs
    where organization_id=$1 and metadata->>'chitId' = $2
    order by created_at desc
    limit 500
    `,
    [orgId, chitId],
  );
  res.json({ audit_log: rows.rows });
}));

module.exports = router;
