const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination, parseBool } = require('../utils/http');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

const toAmount = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function asDateOnly(value, fieldName) {
  if (!value) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is required`);
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is invalid`);
  return d.toISOString().slice(0, 10);
}

function optionalDateOnly(value, fieldName) {
  if (value == null || value === '') return null;
  return asDateOnly(value, fieldName);
}

function validateEnum(val, allowed, fieldName) {
  const v = String(val || '').trim().toUpperCase();
  if (!allowed.includes(v)) throw new ApiError(422, 'VALIDATION_ERROR', `Invalid ${fieldName}`);
  return v;
}

function monthFromDate(dateOnly) {
  return String(dateOnly).slice(0, 7);
}

function calcVariance(gross, cash, tds) {
  return Number((toAmount(gross) - toAmount(cash) - toAmount(tds)).toFixed(2));
}

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['t.organization_id = $1'];

  if (req.query.clientId) { params.push(String(req.query.clientId)); where.push(`t.client_id = $${params.length}`); }
  if (req.query.loanId) { params.push(String(req.query.loanId)); where.push(`t.loan_id = $${params.length}`); }
  if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`t.receipt_status = $${params.length}`); }
  if (req.query.fundingChannel) { params.push(String(req.query.fundingChannel).toUpperCase()); where.push(`coalesce(t.client_funding_channel_snapshot,c.funding_channel,'DIRECT') = $${params.length}`); }
  if (req.query.tieUpPartnerName) { params.push(String(req.query.tieUpPartnerName)); where.push(`coalesce(t.tie_up_partner_name_snapshot,c.tie_up_partner_name,'') = $${params.length}`); }
  if (req.query.fromDate) { params.push(String(req.query.fromDate)); where.push(`t.deduction_date >= $${params.length}::date`); }
  if (req.query.toDate) { params.push(String(req.query.toDate)); where.push(`t.deduction_date <= $${params.length}::date`); }
  if (req.query.periodMonth) { params.push(String(req.query.periodMonth)); where.push(`t.period_month = $${params.length}`); }

  const onlyMismatch = parseBool(req.query.onlyMismatch);
  if (onlyMismatch === true) where.push(`abs(t.gross_emi_amount - t.cash_received_amount - t.tds_amount) > 0.01`);

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    with base as (
      select
        t.*,
        c.name as client_name,
        c.client_code,
        c.funding_channel,
        c.tie_up_partner_name,
        l.loan_number,
        coalesce(co.cash_received_amount, co.amount) as linked_collection_cash_amount,
        count(*) over()::int as total_count
      from client_tds_entries t
      left join clients c on c.id = t.client_id and c.organization_id = t.organization_id
      left join loans l on l.id = t.loan_id and l.organization_id = t.organization_id
      left join collections co on co.id = t.collection_id and co.organization_id = t.organization_id
      where ${where.join(' and ')}
    )
    select * from base
    order by deduction_date desc, created_at desc
    limit $${limitIdx} offset $${offsetIdx}
  `;

  const result = await query(sql, params);
  const items = result.rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name || null,
    clientCode: r.client_code,
    fundingChannel: r.client_funding_channel_snapshot || r.funding_channel || 'DIRECT',
    tieUpPartnerName: r.tie_up_partner_name_snapshot || r.tie_up_partner_name || null,
    loanId: r.loan_id,
    loanNumber: r.loan_number,
    collectionId: r.collection_id,
    deductionDate: r.deduction_date,
    periodMonth: r.period_month,
    grossEmiAmount: toAmount(r.gross_emi_amount),
    cashReceivedAmount: toAmount(r.cash_received_amount),
    tdsRatePercent: r.tds_rate_percent == null ? null : Number(r.tds_rate_percent),
    tdsAmount: toAmount(r.tds_amount),
    receiptStatus: r.receipt_status,
    receivedDate: r.received_date,
    certificateRef: r.certificate_ref,
    sourceType: r.source_type,
    notes: r.notes,
    linkedCollectionCashAmount: r.linked_collection_cash_amount == null ? null : toAmount(r.linked_collection_cash_amount),
    reconciliationVariance: calcVariance(r.gross_emi_amount, r.cash_received_amount, r.tds_amount),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const summaryParams = [orgId];
  const summaryWhere = ['t.organization_id = $1'];
  if (req.query.clientId) { summaryParams.push(String(req.query.clientId)); summaryWhere.push(`t.client_id = $${summaryParams.length}`); }
  if (req.query.fundingChannel) { summaryParams.push(String(req.query.fundingChannel).toUpperCase()); summaryWhere.push(`coalesce(t.client_funding_channel_snapshot,c.funding_channel,'DIRECT') = $${summaryParams.length}`); }
  if (req.query.tieUpPartnerName) { summaryParams.push(String(req.query.tieUpPartnerName)); summaryWhere.push(`coalesce(t.tie_up_partner_name_snapshot,c.tie_up_partner_name,'') = $${summaryParams.length}`); }
  const summary = await query(
    `
    select
      coalesce(sum(t.tds_amount),0) as tds_total,
      coalesce(sum(case when t.receipt_status='PENDING' then t.tds_amount else 0 end),0) as tds_pending,
      coalesce(sum(case when t.receipt_status='RECEIVED' then t.tds_amount else 0 end),0) as tds_received,
      coalesce(sum(t.gross_emi_amount),0) as gross_emi_total,
      coalesce(sum(t.cash_received_amount),0) as cash_received_total
    from client_tds_entries t
    left join clients c on c.id = t.client_id and c.organization_id = t.organization_id
    where ${summaryWhere.join(' and ')}
    `,
    summaryParams,
  );

  res.json({
    items,
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0,
    summary: summary.rows[0] || { tds_total: 0, tds_pending: 0, tds_received: 0, gross_emi_total: 0, cash_received_total: 0 },
  });
}));

router.post('/', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const b = req.body || {};

  const clientId = b.clientId ? String(b.clientId).trim() : null;
  const loanId = b.loanId ? String(b.loanId).trim() : null;
  const collectionId = b.collectionId ? String(b.collectionId).trim() : null;
  const deductionDate = asDateOnly(b.deductionDate || new Date().toISOString(), 'deductionDate');
  const periodMonth = b.periodMonth ? String(b.periodMonth) : monthFromDate(deductionDate);
  const grossEmiAmountInput = toAmount(b.grossEmiAmount);
  let cashReceivedAmountInput = toAmount(b.cashReceivedAmount);
  const tdsRatePercent = b.tdsRatePercent == null || b.tdsRatePercent === '' ? null : toAmount(b.tdsRatePercent);
  const tdsAmount = toAmount(b.tdsAmount);
  const receiptStatus = validateEnum(b.receiptStatus || 'PENDING', ['PENDING', 'RECEIVED'], 'receiptStatus');
  const receivedDate = receiptStatus === 'RECEIVED' ? optionalDateOnly(b.receivedDate || deductionDate, 'receivedDate') : optionalDateOnly(b.receivedDate, 'receivedDate');
  const certificateRef = b.certificateRef == null ? null : String(b.certificateRef).trim() || null;
  const sourceType = validateEnum(b.sourceType || 'CLIENT_COLLECTION', ['CLIENT_COLLECTION', 'TIE_UP_SETTLEMENT', 'MANUAL'], 'sourceType');
  const fundingChannelOverride = b.fundingChannel ? validateEnum(b.fundingChannel, ['DIRECT', 'TIE_UP'], 'fundingChannel') : null;
  const tieUpPartnerNameOverride = b.tieUpPartnerName == null ? null : String(b.tieUpPartnerName).trim() || null;
  const notes = b.notes == null ? null : String(b.notes);

  if (!(tdsAmount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'tdsAmount must be > 0');
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) throw new ApiError(422, 'VALIDATION_ERROR', 'periodMonth must be YYYY-MM');
  if (!clientId) {
    if ((fundingChannelOverride || 'TIE_UP') !== 'TIE_UP') throw new ApiError(422, 'VALIDATION_ERROR', 'Partner-level cumulative TDS must use fundingChannel=TIE_UP');
    if (!tieUpPartnerNameOverride) throw new ApiError(422, 'VALIDATION_ERROR', 'tieUpPartnerName is required for partner-level cumulative TDS');
  }

  const out = await withTransaction(async (dbClient) => {
    let client = null;
    if (clientId) {
      const clientRes = await query(`select id, name, funding_channel, tie_up_partner_name from clients where organization_id=$1 and id=$2`, [orgId, clientId], dbClient);
      client = clientRes.rows[0];
      if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
    }

    if (loanId) {
      if (!clientId) throw new ApiError(422, 'VALIDATION_ERROR', 'loanId requires clientId');
      const loanRes = await query(`select id, client_id from loans where organization_id=$1 and id=$2`, [orgId, loanId], dbClient);
      const loan = loanRes.rows[0];
      if (!loan) throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan not found');
      if (loan.client_id !== clientId) throw new ApiError(422, 'VALIDATION_ERROR', 'loanId does not belong to clientId');
    }

    if (collectionId) {
      if (!clientId) throw new ApiError(422, 'VALIDATION_ERROR', 'collectionId requires clientId');
      const cRes = await query(`select id, client_id, loan_id, amount, cash_received_amount from collections where organization_id=$1 and id=$2`, [orgId, collectionId], dbClient);
      const col = cRes.rows[0];
      if (!col) throw new ApiError(404, 'COLLECTION_NOT_FOUND', 'Collection not found');
      if (col.client_id !== clientId) throw new ApiError(422, 'VALIDATION_ERROR', 'collectionId does not belong to clientId');
      if (loanId && col.loan_id && col.loan_id !== loanId) throw new ApiError(422, 'VALIDATION_ERROR', 'collectionId does not belong to loanId');
      if (!cashReceivedAmountInput) cashReceivedAmountInput = toAmount(col.cash_received_amount == null ? col.amount : col.cash_received_amount);
    }

    const grossEmiAmount = grossEmiAmountInput > 0 ? grossEmiAmountInput : Number((cashReceivedAmountInput + tdsAmount).toFixed(2));
    const variance = calcVariance(grossEmiAmount, cashReceivedAmountInput, tdsAmount);
    const reconciliationStatus = Math.abs(variance) <= 0.01 ? 'MATCHED' : 'VARIANCE';

    const insert = await query(
      `
      insert into client_tds_entries (
        organization_id, client_id, loan_id, collection_id, deduction_date, period_month,
        gross_emi_amount, cash_received_amount, tds_rate_percent, tds_amount,
        receipt_status, received_date, certificate_ref, source_type,
        client_funding_channel_snapshot, tie_up_partner_name_snapshot, notes, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      returning *
      `,
      [
        orgId, clientId, loanId, collectionId, deductionDate, periodMonth,
        grossEmiAmount, cashReceivedAmountInput, tdsRatePercent, tdsAmount,
        receiptStatus, receivedDate, certificateRef, sourceType,
        (client?.funding_channel || fundingChannelOverride || 'DIRECT'),
        (client?.tie_up_partner_name || tieUpPartnerNameOverride || null),
        notes, userId,
      ],
      dbClient,
    );
    return { row: insert.rows[0], clientName: client?.name || null, reconciliationStatus, variance };
  });

  res.status(201).json({
    item: {
      id: out.row.id,
      clientId: out.row.client_id,
      clientName: out.clientName,
      loanId: out.row.loan_id,
      collectionId: out.row.collection_id,
      deductionDate: out.row.deduction_date,
      periodMonth: out.row.period_month,
      grossEmiAmount: toAmount(out.row.gross_emi_amount),
      cashReceivedAmount: toAmount(out.row.cash_received_amount),
      tdsRatePercent: out.row.tds_rate_percent == null ? null : Number(out.row.tds_rate_percent),
      tdsAmount: toAmount(out.row.tds_amount),
      receiptStatus: out.row.receipt_status,
      receivedDate: out.row.received_date,
      certificateRef: out.row.certificate_ref,
      sourceType: out.row.source_type,
      fundingChannel: out.row.client_funding_channel_snapshot || 'DIRECT',
      tieUpPartnerName: out.row.tie_up_partner_name_snapshot || null,
      notes: out.row.notes,
      reconciliationStatus: out.reconciliationStatus,
      reconciliationVariance: out.variance,
    },
  });
}));

router.patch('/:tdsId', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { tdsId } = req.params;
  const b = req.body || {};
  const sets = [];
  const values = [orgId, tdsId];

  if (Object.prototype.hasOwnProperty.call(b, 'receiptStatus')) {
    values.push(validateEnum(b.receiptStatus, ['PENDING', 'RECEIVED'], 'receiptStatus'));
    sets.push(`receipt_status = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(b, 'receivedDate')) {
    values.push(optionalDateOnly(b.receivedDate, 'receivedDate'));
    sets.push(`received_date = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(b, 'certificateRef')) {
    values.push(b.certificateRef == null ? null : String(b.certificateRef).trim() || null);
    sets.push(`certificate_ref = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(b, 'notes')) {
    values.push(b.notes == null ? null : String(b.notes));
    sets.push(`notes = $${values.length}`);
  }
  if (!sets.length) throw new ApiError(422, 'VALIDATION_ERROR', 'No fields to update');
  sets.push('updated_at = now()');

  const result = await query(
    `update client_tds_entries set ${sets.join(', ')} where organization_id=$1 and id=$2 returning *`,
    values,
  );
  if (!result.rows[0]) throw new ApiError(404, 'TDS_ENTRY_NOT_FOUND', 'TDS entry not found');

  const r = result.rows[0];
  res.json({
    item: {
      id: r.id,
      receiptStatus: r.receipt_status,
      receivedDate: r.received_date,
      certificateRef: r.certificate_ref,
      notes: r.notes,
      reconciliationVariance: calcVariance(r.gross_emi_amount, r.cash_received_amount, r.tds_amount),
    },
  });
}));

module.exports = router;
