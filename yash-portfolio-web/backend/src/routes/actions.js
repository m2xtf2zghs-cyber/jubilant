const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function deriveInstallmentStatus(scheduledAmount, paidAmount) {
  const scheduled = Number(scheduledAmount || 0);
  const paid = Number(paidAmount || 0);
  if (paid <= 0.000001) return 'PENDING';
  if (paid + 0.000001 >= scheduled) return 'PAID';
  return 'PARTIAL';
}

const toPaise = (v) => Math.round((Number(v) || 0) * 100);
const fromPaise = (p) => Number((p / 100).toFixed(2));

function monthFromDate(dateOnly) {
  return String(dateOnly).slice(0, 7);
}

function deriveInstallmentSplit(loan, installment) {
  const metadata = parseJsonObject(installment.metadata);
  const scheduled = toPaise(installment.scheduled_amount);
  const paid = toPaise(installment.paid_amount);
  const loanTotal = toPaise(loan.total_amount);
  const loanPrincipal = toPaise(loan.principal_amount);

  let principalDue = Number.isFinite(Number(metadata.principal_due))
    ? toPaise(metadata.principal_due)
    : (loanTotal > 0 ? Math.round((scheduled * loanPrincipal) / loanTotal) : scheduled);
  if (principalDue < 0) principalDue = 0;
  if (principalDue > scheduled) principalDue = scheduled;
  const interestDue = Math.max(0, scheduled - principalDue);

  let principalPaid;
  let interestPaid;

  if (Number.isFinite(Number(metadata.principal_paid)) || Number.isFinite(Number(metadata.interest_paid))) {
    principalPaid = Math.min(principalDue, Math.max(0, toPaise(metadata.principal_paid || 0)));
    interestPaid = Math.min(interestDue, Math.max(0, toPaise(metadata.interest_paid || 0)));
  } else {
    interestPaid = Math.min(interestDue, Math.max(0, paid));
    principalPaid = Math.min(principalDue, Math.max(0, paid - interestPaid));
  }

  return { metadata, principalDue, interestDue, principalPaid, interestPaid, scheduled, paid };
}

async function maybeClearChitCollectionLink(dbClient, orgId, collectionId) {
  try {
    await query(
      `update chit_capital_returns set linked_collection_id = null where organization_id = $1 and linked_collection_id = $2`,
      [orgId, collectionId],
      dbClient
    );
  } catch (err) {
    if (err?.code !== '42P01') throw err; // undefined table (module not applied)
  }
}

async function maybeDeleteTdsByCollection(dbClient, orgId, collectionId) {
  try {
    await query(
      `delete from client_tds_entries where organization_id = $1 and collection_id = $2`,
      [orgId, collectionId],
      dbClient
    );
  } catch (err) {
    if (err?.code !== '42P01') throw err; // undefined table (module not applied)
  }
}

async function verifyActionPassword(dbClient, orgId, userId, password) {
  const pwd = String(password || '');
  if (!pwd) throw new ApiError(422, 'VALIDATION_ERROR', 'password is required');
  const hit = await query(
    `select password_hash from users where organization_id = $1 and id = $2`,
    [orgId, userId],
    dbClient
  );
  const user = hit.rows[0];
  if (!user?.password_hash) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid password');
  const ok = await bcrypt.compare(pwd, user.password_hash);
  if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid password');
}

async function fetchLatestUndoCandidate(dbClient, orgId, userId, actionType) {
  if (actionType === 'CAPITAL') {
    const hit = await query(
      `
      select 'CAPITAL' as action_type, id as entity_id, created_at, amount, description
      from ledger_entries
      where organization_id = $1
        and created_by = $2
        and tx_type = 'CREDIT'
        and tag = 'CAPITAL'
        and created_at >= now() - interval '5 minutes'
      order by created_at desc
      limit 1
      `,
      [orgId, userId],
      dbClient
    );
    return hit.rows[0] || null;
  }

  if (actionType === 'COLLECTION') {
    const hit = await query(
      `
      select 'COLLECTION' as action_type, id as entity_id, created_at, amount, notes as description
      from collections
      where organization_id = $1
        and created_by = $2
        and created_at >= now() - interval '5 minutes'
      order by created_at desc
      limit 1
      `,
      [orgId, userId],
      dbClient
    );
    return hit.rows[0] || null;
  }

  if (actionType === 'EXPENSE') {
    const hit = await query(
      `
      select 'EXPENSE' as action_type, id as entity_id, created_at, amount, description
      from expenses
      where organization_id = $1
        and created_by = $2
        and created_at >= now() - interval '5 minutes'
      order by created_at desc
      limit 1
      `,
      [orgId, userId],
      dbClient
    );
    return hit.rows[0] || null;
  }

  const hit = await query(
    `
    with candidates as (
      select 'CAPITAL' as action_type, id as entity_id, created_at, amount, description
      from ledger_entries
      where organization_id = $1
        and created_by = $2
        and tx_type = 'CREDIT'
        and tag = 'CAPITAL'
        and created_at >= now() - interval '5 minutes'
      union all
      select 'COLLECTION' as action_type, id as entity_id, created_at, amount, notes as description
      from collections
      where organization_id = $1
        and created_by = $2
        and created_at >= now() - interval '5 minutes'
      union all
      select 'EXPENSE' as action_type, id as entity_id, created_at, amount, description
      from expenses
      where organization_id = $1
        and created_by = $2
        and created_at >= now() - interval '5 minutes'
    )
    select * from candidates
    order by created_at desc
    limit 1
    `,
    [orgId, userId],
    dbClient
  );
  return hit.rows[0] || null;
}

async function undoCapital(dbClient, orgId, userId, entityId, opts = {}) {
  const requireCreator = opts.requireCreator !== false;
  const enforceWindow = opts.enforceWindow !== false;
  const where = [
    'organization_id = $1',
    'id = $2',
    `tx_type = 'CREDIT'`,
    `tag = 'CAPITAL'`,
  ];
  const params = [orgId, entityId];
  if (requireCreator) {
    params.push(userId);
    where.push(`created_by = $${params.length}`);
  }
  if (enforceWindow) where.push(`created_at >= now() - interval '5 minutes'`);
  const hit = await query(
    `
    select *
    from ledger_entries
    where ${where.join(' and ')}
    for update
    `,
    params,
    dbClient
  );
  const row = hit.rows[0];
  if (!row) throw new ApiError(404, 'UNDO_NOT_ALLOWED', opts.missingMessage || 'No capital action eligible for undo (5 min window expired).');

  await query(`delete from ledger_entries where organization_id = $1 and id = $2`, [orgId, row.id], dbClient);

  await query(
    `
        insert into audit_logs (
          organization_id, actor_user_id, entity_type, entity_id, action, metadata, before_data
        ) values (
          $1,$2,'ledger_entry',$3,$4,$5::jsonb,$6::jsonb
        )
      `,
      [
        orgId,
        userId,
        row.id,
        opts.auditAction || 'UNDO_CAPITAL',
        JSON.stringify({ undoWindowMinutes: enforceWindow ? 5 : null }),
        JSON.stringify({
          amount: Number(row.amount || 0),
          description: row.description,
        createdAt: row.created_at,
      }),
    ],
    dbClient
  );

  return {
    actionType: opts.returnActionType || 'CAPITAL',
    entityId: row.id,
    amount: Number(row.amount || 0),
    description: row.description || null,
  };
}

async function undoExpense(dbClient, orgId, userId, entityId, opts = {}) {
  const requireCreator = opts.requireCreator !== false;
  const enforceWindow = opts.enforceWindow !== false;
  const where = ['organization_id = $1', 'id = $2'];
  const params = [orgId, entityId];
  if (requireCreator) {
    params.push(userId);
    where.push(`created_by = $${params.length}`);
  }
  if (enforceWindow) where.push(`created_at >= now() - interval '5 minutes'`);
  const hit = await query(
    `
    select *
    from expenses
    where ${where.join(' and ')}
    for update
    `,
    params,
    dbClient
  );
  const row = hit.rows[0];
  if (!row) throw new ApiError(404, 'UNDO_NOT_ALLOWED', opts.missingMessage || 'No expense action eligible for undo (5 min window expired).');

  await query(`delete from ledger_entries where organization_id = $1 and expense_id = $2`, [orgId, row.id], dbClient);
  await query(`delete from expenses where organization_id = $1 and id = $2`, [orgId, row.id], dbClient);

  await query(
    `
    insert into audit_logs (
      organization_id, actor_user_id, entity_type, entity_id, action, metadata, before_data
      ) values (
        $1,$2,'expense',$3,$4,$5::jsonb,$6::jsonb
      )
    `,
    [
      orgId,
      userId,
      row.id,
      opts.auditAction || 'UNDO_EXPENSE',
      JSON.stringify({ undoWindowMinutes: enforceWindow ? 5 : null }),
      JSON.stringify({
        amount: Number(row.amount || 0),
        description: row.description,
        category: row.category,
        expenseDate: row.expense_date,
        createdAt: row.created_at,
      }),
    ],
    dbClient
  );

  return {
    actionType: opts.returnActionType || 'EXPENSE',
    entityId: row.id,
    amount: Number(row.amount || 0),
    description: row.description || null,
  };
}

async function undoCollection(dbClient, orgId, userId, entityId, opts = {}) {
  const requireCreator = opts.requireCreator !== false;
  const enforceWindow = opts.enforceWindow !== false;
  const where = [
    'co.organization_id = $1',
    'co.id = $2',
  ];
  const params = [orgId, entityId];
  if (requireCreator) {
    params.push(userId);
    where.push(`co.created_by = $${params.length}`);
  }
  if (enforceWindow) where.push(`co.created_at >= now() - interval '5 minutes'`);
  const hit = await query(
    `
    select
      co.*,
      i.scheduled_amount, i.paid_amount, i.status as installment_status, i.paid_at, i.metadata as installment_metadata,
      l.status as loan_status,
      c.name as client_name
    from collections co
    join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
    join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
    join clients c on c.id = co.client_id and c.organization_id = co.organization_id
    where ${where.join(' and ')}
    for update of co, i, l
    `,
    params,
    dbClient
  );
  const row = hit.rows[0];
  if (!row) throw new ApiError(404, 'UNDO_NOT_ALLOWED', opts.missingMessage || 'No collection action eligible for undo (5 min window expired).');

  const newer = await query(
    `
    select id
    from collections
    where organization_id = $1
      and installment_id = $2
      and id <> $3
      and (collection_date > $4 or (collection_date = $4 and created_at > $5))
    limit 1
    `,
    [orgId, row.installment_id, row.id, row.collection_date, row.created_at],
    dbClient
  );
  if (newer.rows[0]) {
    throw new ApiError(409, 'UNDO_CONFLICT', 'Cannot undo: later collection exists for this installment.');
  }

  const prevCollection = await query(
    `
    select id, collection_date
    from collections
    where organization_id = $1 and installment_id = $2 and id <> $3
    order by collection_date desc, created_at desc
    limit 1
    `,
    [orgId, row.installment_id, row.id],
    dbClient
  );
  const prevCollectionId = prevCollection.rows[0]?.id || null;
  const prevCollectionDate = prevCollection.rows[0]?.collection_date || null;

  const scheduled = Number(row.scheduled_amount || 0);
  const currentPaid = Number(row.paid_amount || 0);
  const amount = Number(row.amount || 0);
  const paidDelta = row.is_writeoff ? 0 : amount;
  const nextPaid = Math.max(0, Number((currentPaid - paidDelta).toFixed(2)));
  const nextStatus = deriveInstallmentStatus(scheduled, nextPaid);
  const nextPaidAt = nextStatus === 'PENDING' ? null : (prevCollectionDate || null);

  const metadata = parseJsonObject(row.installment_metadata);
  let nextMetadata = { ...metadata };
  if (row.is_writeoff) {
    delete nextMetadata.writeoff_amount;
    delete nextMetadata.writeoff_at;
  } else {
    const principalComponent = Number(row.principal_component || 0);
    const interestComponent = Number(row.interest_component || 0);
    nextMetadata.principal_paid = Math.max(0, Number((Number(nextMetadata.principal_paid || 0) - principalComponent).toFixed(2)));
    nextMetadata.interest_paid = Math.max(0, Number((Number(nextMetadata.interest_paid || 0) - interestComponent).toFixed(2)));
  }

  await query(
    `
    update installments
    set
      paid_amount = $4,
      status = $5,
      paid_at = $6,
      last_collection_id = $7,
      metadata = $8::jsonb,
      updated_at = now(),
      version = version + 1
    where organization_id = $1 and id = $2 and loan_id = $3
    `,
    [orgId, row.installment_id, row.loan_id, nextPaid, nextStatus, nextPaidAt, prevCollectionId, JSON.stringify(nextMetadata)],
    dbClient
  );

  await maybeClearChitCollectionLink(dbClient, orgId, row.id);
  await maybeDeleteTdsByCollection(dbClient, orgId, row.id);
  await query(`delete from ledger_entries where organization_id = $1 and collection_id = $2`, [orgId, row.id], dbClient);
  await query(`delete from collections where organization_id = $1 and id = $2`, [orgId, row.id], dbClient);

  const pendingRes = await query(
    `
    select count(*)::int as pending_count
    from installments
    where organization_id = $1 and loan_id = $2 and status in ('PENDING','PARTIAL')
    `,
    [orgId, row.loan_id],
    dbClient
  );
  const pendingCount = Number(pendingRes.rows[0]?.pending_count || 0);
  let loanStatus = row.loan_status;
  if (pendingCount > 0 && String(row.loan_status || '').toUpperCase() === 'CLOSED') {
    const loanUpd = await query(
      `
      update loans
      set status = 'ACTIVE', closed_at = null, closed_reason = null, updated_at = now(), version = version + 1
      where organization_id = $1 and id = $2
      returning status
      `,
      [orgId, row.loan_id],
      dbClient
    );
    loanStatus = loanUpd.rows[0]?.status || 'ACTIVE';
  }

  await query(
    `
    insert into audit_logs (
      organization_id, actor_user_id, entity_type, entity_id, action, metadata, before_data, after_data
      ) values (
        $1,$2,'collection',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb
      )
    `,
    [
      orgId,
      userId,
      row.id,
      opts.auditAction || 'UNDO_COLLECTION',
      JSON.stringify({ undoWindowMinutes: enforceWindow ? 5 : null }),
      JSON.stringify({
        amount,
        cashReceivedAmount: Number(row.cash_received_amount || 0),
        tdsDeductedAmount: Number(row.tds_deducted_amount || 0),
        isWriteoff: !!row.is_writeoff,
        installmentId: row.installment_id,
        loanId: row.loan_id,
      }),
      JSON.stringify({
        installmentStatus: nextStatus,
        installmentPaidAmount: nextPaid,
        loanStatus,
      }),
    ],
    dbClient
  );

  return {
    actionType: opts.returnActionType || 'COLLECTION',
    entityId: row.id,
    amount,
    description: `Collection — ${row.client_name}`,
    loanId: row.loan_id,
    installmentId: row.installment_id,
  };
}

router.post('/undo-last', requireRoles('OWNER', 'ACCOUNTS_OFFICER', 'COLLECTION_AGENT'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const actionTypeRaw = (req.body || {}).actionType;
  const actionType = actionTypeRaw ? String(actionTypeRaw).trim().toUpperCase() : null;
  if (actionType && !['CAPITAL', 'COLLECTION', 'EXPENSE'].includes(actionType)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'actionType must be CAPITAL, COLLECTION, or EXPENSE');
  }

  const result = await withTransaction(async (client) => {
    const candidate = await fetchLatestUndoCandidate(client, orgId, userId, actionType);
    if (!candidate) {
      throw new ApiError(404, 'NOTHING_TO_UNDO', 'No eligible action found in last 5 minutes.');
    }
    if (candidate.action_type === 'CAPITAL') return undoCapital(client, orgId, userId, candidate.entity_id);
    if (candidate.action_type === 'COLLECTION') return undoCollection(client, orgId, userId, candidate.entity_id);
    return undoExpense(client, orgId, userId, candidate.entity_id);
  });

  res.json({
    ok: true,
    undone: result,
    windowMinutes: 5,
    undoneAt: new Date().toISOString(),
  });
}));

router.post('/protected-delete', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};
  const actionType = String(body.actionType || '').trim().toUpperCase();
  const entityId = String(body.entityId || '').trim();
  const password = String(body.password || '');
  if (!['CAPITAL', 'COLLECTION', 'EXPENSE'].includes(actionType)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'actionType must be CAPITAL, COLLECTION, or EXPENSE');
  }
  if (!entityId) throw new ApiError(422, 'VALIDATION_ERROR', 'entityId is required');

  const deleted = await withTransaction(async (client) => {
    await verifyActionPassword(client, orgId, userId, password);
    if (actionType === 'CAPITAL') {
      return undoCapital(client, orgId, userId, entityId, {
        enforceWindow: false,
        requireCreator: false,
        missingMessage: 'Capital entry not found.',
        auditAction: 'DELETE_CAPITAL_PROTECTED',
        returnActionType: 'CAPITAL_DELETE',
      });
    }
    if (actionType === 'COLLECTION') {
      return undoCollection(client, orgId, userId, entityId, {
        enforceWindow: false,
        requireCreator: false,
        missingMessage: 'Collection entry not found.',
        auditAction: 'DELETE_COLLECTION_PROTECTED',
        returnActionType: 'COLLECTION_DELETE',
      });
    }
    return undoExpense(client, orgId, userId, entityId, {
      enforceWindow: false,
      requireCreator: false,
      missingMessage: 'Expense entry not found.',
      auditAction: 'DELETE_EXPENSE_PROTECTED',
      returnActionType: 'EXPENSE_DELETE',
    });
  });

  res.json({ ok: true, deleted, deletedAt: new Date().toISOString() });
}));

router.post('/protected-edit', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};
  const actionType = String(body.actionType || '').trim().toUpperCase();
  const entityId = String(body.entityId || '').trim();
  const patch = (body.patch && typeof body.patch === 'object') ? body.patch : {};
  const password = String(body.password || '');
  if (!['CAPITAL', 'COLLECTION', 'EXPENSE'].includes(actionType)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'actionType must be CAPITAL, COLLECTION, or EXPENSE');
  }
  if (!entityId) throw new ApiError(422, 'VALIDATION_ERROR', 'entityId is required');

  const edited = await withTransaction(async (client) => {
    await verifyActionPassword(client, orgId, userId, password);

    if (actionType === 'CAPITAL') {
      const hit = await query(
        `
        select *
        from ledger_entries
        where organization_id = $1 and id = $2 and tx_type = 'CREDIT' and tag = 'CAPITAL'
        for update
        `,
        [orgId, entityId],
        client
      );
      const row = hit.rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Capital entry not found');

      const amount = patch.amount == null ? Number(row.amount || 0) : Number(patch.amount);
      if (!(amount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amount must be > 0');
      const description = patch.description == null ? row.description : String(patch.description || '').trim();
      if (!description) throw new ApiError(422, 'VALIDATION_ERROR', 'description is required');
      const entryTime = patch.entryTime == null ? row.entry_time : new Date(String(patch.entryTime));
      if (Number.isNaN(new Date(entryTime).getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'entryTime is invalid');

      const upd = await query(
        `
        update ledger_entries
        set amount = $3, description = $4, entry_time = $5, created_at = created_at
        where organization_id = $1 and id = $2
        returning *
        `,
        [orgId, row.id, amount, description, new Date(entryTime).toISOString()],
        client
      );

      await query(
        `
        insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
        values ($1,$2,'ledger_entry',$3,'EDIT_CAPITAL_PROTECTED',$4::jsonb,$5::jsonb)
        `,
        [
          orgId,
          userId,
          row.id,
          JSON.stringify({ amount: Number(row.amount || 0), description: row.description, entryTime: row.entry_time }),
          JSON.stringify({ amount, description, entryTime: new Date(entryTime).toISOString() }),
        ],
        client
      );

      return { actionType: 'CAPITAL_EDIT', entityId: row.id, amount, description };
    }

    if (actionType === 'EXPENSE') {
      const hit = await query(
        `select * from expenses where organization_id = $1 and id = $2 for update`,
        [orgId, entityId],
        client
      );
      const row = hit.rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Expense entry not found');

      const amount = patch.amount == null ? Number(row.amount || 0) : Number(patch.amount);
      if (!(amount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amount must be > 0');
      const description = patch.description == null ? row.description : String(patch.description || '').trim();
      const category = patch.category == null ? row.category : String(patch.category || '').trim();
      if (!description || !category) throw new ApiError(422, 'VALIDATION_ERROR', 'description and category are required');
      const expenseDate = patch.expenseDate == null ? row.expense_date : new Date(String(patch.expenseDate));
      if (Number.isNaN(new Date(expenseDate).getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'expenseDate is invalid');

      await query(
        `
        update expenses
        set amount = $3, description = $4, category = $5, expense_date = $6
        where organization_id = $1 and id = $2
        `,
        [orgId, row.id, amount, description, category, new Date(expenseDate).toISOString()],
        client
      );
      await query(
        `
        update ledger_entries
        set amount = $3, description = $4, category = $5, entry_time = $6
        where organization_id = $1 and expense_id = $2
        `,
        [orgId, row.id, amount, description, category, new Date(expenseDate).toISOString()],
        client
      );
      await query(
        `
        insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
        values ($1,$2,'expense',$3,'EDIT_EXPENSE_PROTECTED',$4::jsonb,$5::jsonb)
        `,
        [
          orgId,
          userId,
          row.id,
          JSON.stringify({ amount: Number(row.amount || 0), description: row.description, category: row.category, expenseDate: row.expense_date }),
          JSON.stringify({ amount, description, category, expenseDate: new Date(expenseDate).toISOString() }),
        ],
        client
      );
      return { actionType: 'EXPENSE_EDIT', entityId: row.id, amount, description, category };
    }

    const hit = await query(
      `
      select
        co.*,
        i.scheduled_amount,
        i.paid_amount,
        i.status as installment_status,
        i.last_collection_id,
        i.metadata as installment_metadata,
        l.status as loan_status,
        l.total_amount,
        l.principal_amount,
        c.funding_channel as client_funding_channel,
        c.tie_up_partner_name as client_tie_up_partner_name
      from collections co
      join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
      join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
      join clients c on c.id = co.client_id and c.organization_id = co.organization_id
      where co.organization_id = $1 and co.id = $2
      for update of co, i, l, c
      `,
      [orgId, entityId],
      client
    );
    const row = hit.rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Collection entry not found');
    if (row.is_writeoff) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Write-off entries cannot be edited from collection editor');
    }

    const notes = patch.notes == null ? row.notes : String(patch.notes || '');
    const paymentMode = patch.paymentMode == null ? row.payment_mode : String(patch.paymentMode || '').trim().toUpperCase();
    const collectionDate = patch.collectionDate == null ? row.collection_date : new Date(String(patch.collectionDate));
    if (!paymentMode) throw new ApiError(422, 'VALIDATION_ERROR', 'paymentMode is required');
    if (Number.isNaN(new Date(collectionDate).getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'collectionDate is invalid');

    const hasAmountPatch = Object.prototype.hasOwnProperty.call(patch, 'amount');
    const hasCashPatch = Object.prototype.hasOwnProperty.call(patch, 'cashReceivedAmount');
    const hasTdsPatch = Object.prototype.hasOwnProperty.call(patch, 'tdsDeductedAmount');

    let grossPaise = hasAmountPatch ? toPaise(patch.amount) : toPaise(row.amount);
    let cashPaise = hasCashPatch ? toPaise(patch.cashReceivedAmount) : toPaise(row.cash_received_amount == null ? row.amount : row.cash_received_amount);
    let tdsPaise = hasTdsPatch ? toPaise(patch.tdsDeductedAmount) : toPaise(row.tds_deducted_amount || 0);

    if (!hasAmountPatch && (hasCashPatch || hasTdsPatch)) {
      grossPaise = cashPaise + tdsPaise;
    } else if (hasAmountPatch && !hasCashPatch && !hasTdsPatch) {
      cashPaise = Math.max(0, grossPaise - tdsPaise);
    }

    if (!(grossPaise > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'amount must be > 0');
    if (cashPaise < 0) throw new ApiError(422, 'VALIDATION_ERROR', 'cashReceivedAmount cannot be negative');
    if (tdsPaise < 0) throw new ApiError(422, 'VALIDATION_ERROR', 'tdsDeductedAmount cannot be negative');
    if (cashPaise + tdsPaise !== grossPaise) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'amount must equal cashReceivedAmount + tdsDeductedAmount');
    }

    const collectionsRes = await query(
      `
      select id, amount, collection_date, created_at
      from collections
      where organization_id = $1 and installment_id = $2 and is_writeoff = false
      order by collection_date asc, created_at asc, id asc
      for update
      `,
      [orgId, row.installment_id],
      client
    );
    const collectionRows = collectionsRes.rows || [];
    if (!collectionRows.length) throw new ApiError(404, 'NOT_FOUND', 'No collection rows found for installment');

    const nextAmountsPaise = new Map();
    let targetFound = false;
    collectionRows.forEach((c) => {
      if (String(c.id) === String(row.id)) {
        nextAmountsPaise.set(String(c.id), grossPaise);
        targetFound = true;
      } else {
        nextAmountsPaise.set(String(c.id), toPaise(c.amount));
      }
    });
    if (!targetFound) throw new ApiError(404, 'NOT_FOUND', 'Collection row not found in installment sequence');

    const scheduledPaise = toPaise(row.scheduled_amount);
    const totalPaidPaise = Array.from(nextAmountsPaise.values()).reduce((a, v) => a + v, 0);
    if (totalPaidPaise > scheduledPaise) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Edited amount exceeds installment due amount', {
        installmentDue: fromPaise(scheduledPaise),
        totalAfterEdit: fromPaise(totalPaidPaise),
      });
    }

    const splitBase = deriveInstallmentSplit(
      { total_amount: row.total_amount, principal_amount: row.principal_amount },
      { scheduled_amount: row.scheduled_amount, paid_amount: row.paid_amount, metadata: row.installment_metadata }
    );
    const principalDue = splitBase.principalDue;
    const interestDue = splitBase.interestDue;

    let runningPaidPaise = 0;
    let principalPaidPaise = 0;
    let interestPaidPaise = 0;
    const componentMap = new Map();
    for (const c of collectionRows) {
      const amountPaise = nextAmountsPaise.get(String(c.id)) || 0;
      let left = amountPaise;
      const interestRemaining = Math.max(0, interestDue - interestPaidPaise);
      let interestComponentPaise = Math.min(left, interestRemaining);
      left -= interestComponentPaise;
      const principalRemaining = Math.max(0, principalDue - principalPaidPaise);
      let principalComponentPaise = Math.min(left, principalRemaining);
      left -= principalComponentPaise;
      if (left > 0) {
        const principalExtra = Math.min(left, Math.max(0, principalDue - (principalPaidPaise + principalComponentPaise)));
        principalComponentPaise += principalExtra;
        left -= principalExtra;
      }
      if (left > 0) {
        const interestExtra = Math.min(left, Math.max(0, interestDue - (interestPaidPaise + interestComponentPaise)));
        interestComponentPaise += interestExtra;
        left -= interestExtra;
      }
      if (left > 0) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Collection split overflow; reduce edited amount');
      }
      principalPaidPaise += principalComponentPaise;
      interestPaidPaise += interestComponentPaise;
      runningPaidPaise += amountPaise;
      componentMap.set(String(c.id), {
        amountPaise,
        principalComponentPaise,
        interestComponentPaise,
        isPartial: runningPaidPaise < scheduledPaise,
      });
    }

    const collectionDateIso = new Date(collectionDate).toISOString();
    const lastCollectionOrdered = collectionRows
      .map(c => ({
        id: c.id,
        collection_date: String(c.id) === String(row.id) ? collectionDateIso : c.collection_date,
        created_at: c.created_at,
      }))
      .sort((a, b) => {
        const d = new Date(a.collection_date) - new Date(b.collection_date);
        if (d) return d;
        const cAt = new Date(a.created_at) - new Date(b.created_at);
        if (cAt) return cAt;
        return String(a.id).localeCompare(String(b.id));
      });
    const lastCollection = lastCollectionOrdered[lastCollectionOrdered.length - 1] || null;

    for (const c of collectionRows) {
      const split = componentMap.get(String(c.id));
      if (!split) continue;
      if (String(c.id) === String(row.id)) {
        await query(
          `
          update collections
          set amount = $3,
              cash_received_amount = $4,
              tds_deducted_amount = $5,
              principal_component = $6,
              interest_component = $7,
              split_method = 'INTEREST_FIRST_EMI_SPLIT',
              is_partial = $8,
              notes = $9,
              payment_mode = $10,
              collection_date = $11,
              updated_at = now()
          where organization_id = $1 and id = $2
          `,
          [
            orgId,
            row.id,
            fromPaise(split.amountPaise),
            fromPaise(cashPaise),
            fromPaise(tdsPaise),
            fromPaise(split.principalComponentPaise),
            fromPaise(split.interestComponentPaise),
            split.isPartial,
            notes,
            paymentMode,
            collectionDateIso,
          ],
          client
        );
      } else {
        await query(
          `
          update collections
          set amount = $3,
              principal_component = $4,
              interest_component = $5,
              split_method = 'INTEREST_FIRST_EMI_SPLIT',
              is_partial = $6,
              updated_at = now()
          where organization_id = $1 and id = $2
          `,
          [
            orgId,
            c.id,
            fromPaise(split.amountPaise),
            fromPaise(split.principalComponentPaise),
            fromPaise(split.interestComponentPaise),
            split.isPartial,
          ],
          client
        );
      }
    }

    await query(
      `
      update ledger_entries
      set entry_time = $3, amount = $4
      where organization_id = $1 and collection_id = $2
      `,
      [orgId, row.id, collectionDateIso, fromPaise(cashPaise)],
      client
    );

    const nextInstallmentStatus = deriveInstallmentStatus(fromPaise(scheduledPaise), fromPaise(totalPaidPaise));
    const nextMetadata = {
      ...splitBase.metadata,
      split_method: 'INTEREST_FIRST_EMI_SPLIT',
      principal_due: fromPaise(principalDue),
      interest_due: fromPaise(interestDue),
      principal_paid: fromPaise(principalPaidPaise),
      interest_paid: fromPaise(interestPaidPaise),
    };
    delete nextMetadata.writeoff_amount;
    delete nextMetadata.writeoff_at;

    await query(
      `
      update installments
      set paid_amount = $4,
          status = $5,
          paid_at = $6,
          last_collection_id = $7,
          metadata = $8::jsonb,
          updated_at = now(),
          version = version + 1
      where organization_id = $1 and id = $2 and loan_id = $3
      `,
      [
        orgId,
        row.installment_id,
        row.loan_id,
        fromPaise(totalPaidPaise),
        nextInstallmentStatus,
        nextInstallmentStatus === 'PENDING' ? null : (lastCollection?.collection_date || collectionDateIso),
        nextInstallmentStatus === 'PENDING' ? null : (lastCollection?.id || row.id),
        JSON.stringify(nextMetadata),
      ],
      client
    );

    let loanStatus = row.loan_status;
    const pendingRes = await query(
      `
      select count(*)::int as pending_count
      from installments
      where organization_id = $1 and loan_id = $2 and status in ('PENDING','PARTIAL')
      `,
      [orgId, row.loan_id],
      client
    );
    const pendingCount = Number(pendingRes.rows[0]?.pending_count || 0);
    if (pendingCount === 0 && String(row.loan_status || '').toUpperCase() !== 'CLOSED') {
      const loanUpd = await query(
        `
        update loans
        set status = 'CLOSED', closed_at = coalesce(closed_at, now()), updated_at = now(), version = version + 1
        where organization_id = $1 and id = $2
        returning status
        `,
        [orgId, row.loan_id],
        client
      );
      loanStatus = loanUpd.rows[0]?.status || 'CLOSED';
    } else if (pendingCount > 0 && String(row.loan_status || '').toUpperCase() === 'CLOSED') {
      const loanUpd = await query(
        `
        update loans
        set status = 'ACTIVE', closed_at = null, closed_reason = null, updated_at = now(), version = version + 1
        where organization_id = $1 and id = $2
        returning status
        `,
        [orgId, row.loan_id],
        client
      );
      loanStatus = loanUpd.rows[0]?.status || 'ACTIVE';
    }

    try {
      const tdsHit = await query(
        `
        select * from client_tds_entries
        where organization_id = $1 and collection_id = $2
        for update
        `,
        [orgId, row.id],
        client
      );
      const tdsRow = tdsHit.rows[0] || null;
      const deductionDate = collectionDateIso.slice(0, 10);
      const periodMonth = monthFromDate(deductionDate);
      if (tdsPaise > 0) {
        if (tdsRow) {
          await query(
            `
            update client_tds_entries
            set deduction_date = $3,
                period_month = $4,
                gross_emi_amount = $5,
                cash_received_amount = $6,
                tds_amount = $7,
                updated_at = now()
            where organization_id = $1 and id = $2
            `,
            [orgId, tdsRow.id, deductionDate, periodMonth, fromPaise(grossPaise), fromPaise(cashPaise), fromPaise(tdsPaise)],
            client
          );
        } else {
          const fundingChannel = String(row.client_funding_channel || 'DIRECT').toUpperCase() === 'TIE_UP' ? 'TIE_UP' : 'DIRECT';
          const tieUpName = fundingChannel === 'TIE_UP' ? (row.client_tie_up_partner_name || null) : null;
          const sourceType = fundingChannel === 'TIE_UP' && tieUpName ? 'TIE_UP_SETTLEMENT' : 'CLIENT_COLLECTION';
          await query(
            `
            insert into client_tds_entries (
              organization_id, client_id, loan_id, collection_id, deduction_date, period_month,
              gross_emi_amount, cash_received_amount, tds_amount,
              receipt_status, source_type, client_funding_channel_snapshot, tie_up_partner_name_snapshot, notes, created_by
            ) values (
              $1,$2,$3,$4,$5,$6,
              $7,$8,$9,
              'PENDING',$10,$11,$12,$13,$14
            )
            `,
            [
              orgId,
              row.client_id,
              row.loan_id,
              row.id,
              deductionDate,
              periodMonth,
              fromPaise(grossPaise),
              fromPaise(cashPaise),
              fromPaise(tdsPaise),
              sourceType,
              fundingChannel,
              tieUpName,
              notes || null,
              userId,
            ],
            client
          );
        }
      } else if (tdsRow) {
        await query(`delete from client_tds_entries where organization_id = $1 and id = $2`, [orgId, tdsRow.id], client);
      }
    } catch (err) {
      if (err?.code !== '42P01') throw err;
    }

    await query(
      `
      insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
      values ($1,$2,'collection',$3,'EDIT_COLLECTION_PROTECTED',$4::jsonb,$5::jsonb)
      `,
      [
        orgId,
        userId,
        row.id,
        JSON.stringify({
          amount: Number(row.amount || 0),
          cashReceivedAmount: Number(row.cash_received_amount || row.amount || 0),
          tdsDeductedAmount: Number(row.tds_deducted_amount || 0),
          notes: row.notes,
          paymentMode: row.payment_mode,
          collectionDate: row.collection_date,
        }),
        JSON.stringify({
          amount: fromPaise(grossPaise),
          cashReceivedAmount: fromPaise(cashPaise),
          tdsDeductedAmount: fromPaise(tdsPaise),
          notes,
          paymentMode,
          collectionDate: collectionDateIso,
          installmentStatus: nextInstallmentStatus,
          loanStatus,
        }),
      ],
      client
    );
    return {
      actionType: 'COLLECTION_EDIT',
      entityId: row.id,
      amount: fromPaise(grossPaise),
      cashReceivedAmount: fromPaise(cashPaise),
      tdsDeductedAmount: fromPaise(tdsPaise),
      notes,
      paymentMode,
      collectionDate: collectionDateIso,
      installmentStatus: nextInstallmentStatus,
      loanStatus,
    };
  });

  res.json({ ok: true, edited, editedAt: new Date().toISOString() });
}));

module.exports = router;
