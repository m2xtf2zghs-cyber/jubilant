const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination } = require('../utils/http');

const router = express.Router();

const toPaise = (v) => Math.round((Number(v) || 0) * 100);
const fromPaise = (p) => Number((p / 100).toFixed(2));

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

function asDateOnly(value, fieldName) {
  if (!value) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is required`);
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', `${fieldName} is invalid`);
  return d.toISOString().slice(0, 10);
}

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
    // Fallback for legacy installments without split metadata (interest-first policy).
    interestPaid = Math.min(interestDue, Math.max(0, paid));
    principalPaid = Math.min(principalDue, Math.max(0, paid - interestPaid));
  }

  return { metadata, principalDue, interestDue, principalPaid, interestPaid, scheduled, paid };
}

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['co.organization_id = $1'];

  if (req.query.loanId) { params.push(String(req.query.loanId)); where.push(`co.loan_id = $${params.length}`); }
  if (req.query.clientId) { params.push(String(req.query.clientId)); where.push(`co.client_id = $${params.length}`); }
  if (req.query.agentUserId) { params.push(String(req.query.agentUserId)); where.push(`co.agent_user_id = $${params.length}`); }
  if (req.query.paymentMode) { params.push(String(req.query.paymentMode)); where.push(`co.payment_mode = $${params.length}`); }
  if (req.query.fromDate) { params.push(String(req.query.fromDate)); where.push(`co.collection_date::date >= $${params.length}`); }
  if (req.query.toDate) { params.push(String(req.query.toDate)); where.push(`co.collection_date::date <= $${params.length}`); }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    select
      co.*,
      c.name as client_name,
      l.loan_number,
      i.installment_no,
      count(*) over()::int as total_count
    from collections co
    join clients c on c.id = co.client_id and c.organization_id = co.organization_id
    left join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
    left join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
    where ${where.join(' and ')}
    order by co.collection_date desc, co.created_at desc
    limit $${limitIdx} offset $${offsetIdx}
  `;
  const result = await query(sql, params);
  res.json({
    items: result.rows.map(({ total_count, ...row }) => row),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0,
  });
}));

router.get('/:collectionId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { collectionId } = req.params;
  const result = await query(
    `
    select co.*, c.name as client_name, l.loan_number, i.installment_no
    from collections co
    join clients c on c.id = co.client_id and c.organization_id = co.organization_id
    left join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
    left join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
    where co.organization_id = $1 and co.id = $2
    `,
    [orgId, collectionId]
  );
  if (!result.rows.length) throw new ApiError(404, 'COLLECTION_NOT_FOUND', 'Collection not found');
  res.json({ item: result.rows[0] });
}));

router.post('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};

  const loanId = String(body.loanId || '').trim();
  const installmentId = String(body.installmentId || '').trim();
  const clientId = String(body.clientId || '').trim();
  const amountPaise = toPaise(body.amount || 0);
  const cashReceivedAmountPaiseInput = body.cashReceivedAmount == null || body.cashReceivedAmount === ''
    ? null
    : toPaise(body.cashReceivedAmount);
  const tdsDeductedAmountPaise = toPaise(body.tdsDeductedAmount || 0);
  const tdsReceiptStatus = String(body.tdsReceiptStatus || 'PENDING').trim().toUpperCase();
  const tdsReceivedDate = body.tdsReceivedDate == null || body.tdsReceivedDate === '' ? null : body.tdsReceivedDate;
  const tdsCertificateRef = body.tdsCertificateRef == null ? null : String(body.tdsCertificateRef).trim() || null;
  const tdsSourceTypeInput = String(body.tdsSourceType || '').trim().toUpperCase();
  const tdsFundingChannelInput = body.tdsFundingChannel == null ? null : String(body.tdsFundingChannel).trim().toUpperCase();
  const tdsTieUpPartnerNameInput = body.tdsTieUpPartnerName == null ? null : String(body.tdsTieUpPartnerName).trim() || null;
  const tdsNotes = body.tdsNotes == null ? null : String(body.tdsNotes);
  const isWriteoff = !!body.isWriteoff;
  const paymentMode = String(body.paymentMode || 'CASH').trim() || 'CASH';
  const notes = body.notes == null ? null : String(body.notes);
  const receiptNumber = body.receiptNumber == null ? null : String(body.receiptNumber);
  const agentUserId = body.agentUserId || null;
  const sourceDeviceId = (req.headers['x-device-id'] || body.sourceDeviceId || null);
  const idempotencyKey = (req.headers['idempotency-key'] || body.idempotencyKey || null);
  const collectionDate = body.collectionDate ? new Date(body.collectionDate) : new Date();

  if (!loanId || !installmentId || !clientId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'loanId, installmentId and clientId are required');
  }
  if (amountPaise <= 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'amount must be greater than zero');
  }
  if (cashReceivedAmountPaiseInput != null && cashReceivedAmountPaiseInput < 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'cashReceivedAmount cannot be negative');
  }
  if (tdsDeductedAmountPaise < 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'tdsDeductedAmount cannot be negative');
  }
  if (tdsDeductedAmountPaise > 0 && !['PENDING', 'RECEIVED'].includes(tdsReceiptStatus)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'tdsReceiptStatus must be PENDING or RECEIVED');
  }
  if (Number.isNaN(collectionDate.getTime())) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid collectionDate');
  }
  if (tdsReceivedDate != null) {
    asDateOnly(tdsReceivedDate, 'tdsReceivedDate');
  }

  const cashReceivedAmountPaise = cashReceivedAmountPaiseInput == null
    ? (isWriteoff ? 0 : amountPaise)
    : cashReceivedAmountPaiseInput;
  if (!isWriteoff && (cashReceivedAmountPaise + tdsDeductedAmountPaise !== amountPaise)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'For TDS short receipt, amount must equal cashReceivedAmount + tdsDeductedAmount', {
      amount: fromPaise(amountPaise),
      cashReceivedAmount: fromPaise(cashReceivedAmountPaise),
      tdsDeductedAmount: fromPaise(tdsDeductedAmountPaise),
    });
  }
  if (isWriteoff && (cashReceivedAmountPaise > 0 || tdsDeductedAmountPaise > 0)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Write-off cannot include cashReceivedAmount or tdsDeductedAmount');
  }

  const result = await withTransaction(async (client) => {
    if (idempotencyKey) {
      const existing = await query(
        `
        select co.*, c.name as client_name, l.loan_number, i.installment_no
        from collections co
        join clients c on c.id = co.client_id and c.organization_id = co.organization_id
        left join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
        left join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
        where co.organization_id = $1 and co.idempotency_key = $2
        `,
        [orgId, String(idempotencyKey)],
        client
      );
      if (existing.rows[0]) {
        return { item: existing.rows[0], reused: true };
      }
    }

    const lockRes = await query(
      `
      select
        l.id as loan_id,
        l.client_id,
        l.loan_number,
        l.status as loan_status,
        l.principal_amount,
        l.interest_amount,
        l.total_amount,
        i.id as installment_id,
        i.installment_no,
        i.due_date,
        i.scheduled_amount,
        i.paid_amount,
        i.status as installment_status,
        i.metadata,
        c.name as client_name,
        c.funding_channel as client_funding_channel,
        c.tie_up_partner_name as client_tie_up_partner_name
      from loans l
      join installments i on i.loan_id = l.id and i.organization_id = l.organization_id
      join clients c on c.id = l.client_id and c.organization_id = l.organization_id
      where l.organization_id = $1
        and l.id = $2
        and i.id = $3
      for update of l, i
      `,
      [orgId, loanId, installmentId],
      client
    );

    const row = lockRes.rows[0];
    if (!row) throw new ApiError(404, 'INSTALLMENT_OR_LOAN_NOT_FOUND', 'Loan/installment not found');
    if (row.client_id !== clientId) {
      throw new ApiError(422, 'CLIENT_MISMATCH', 'installmentId does not belong to provided clientId');
    }
    if (!['ACTIVE', 'CLOSED'].includes(String(row.loan_status || ''))) {
      throw new ApiError(422, 'LOAN_NOT_COLLECTIBLE', `Loan status ${row.loan_status} does not allow collection posting`);
    }
    if (['PAID', 'BAD_DEBT', 'CLOSED'].includes(String(row.installment_status || ''))) {
      throw new ApiError(422, 'INSTALLMENT_NOT_COLLECTIBLE', `Installment is already ${row.installment_status}`);
    }

    const scheduledPaise = toPaise(row.scheduled_amount);
    const paidPaise = toPaise(row.paid_amount);
    const outstandingPaise = Math.max(0, scheduledPaise - paidPaise);
    if (outstandingPaise <= 0) {
      throw new ApiError(422, 'INSTALLMENT_ALREADY_SETTLED', 'Installment has no outstanding amount');
    }
    if (amountPaise > outstandingPaise) {
      throw new ApiError(422, 'COLLECTION_EXCEEDS_OUTSTANDING', 'Amount exceeds installment outstanding', {
        outstandingAmount: fromPaise(outstandingPaise),
      });
    }
    if (isWriteoff && amountPaise !== outstandingPaise) {
      throw new ApiError(422, 'WRITEOFF_MUST_MATCH_OUTSTANDING', 'Write-off amount must equal installment outstanding amount', {
        outstandingAmount: fromPaise(outstandingPaise),
      });
    }

    const split = deriveInstallmentSplit(row, row);
    const principalRemaining = Math.max(0, split.principalDue - split.principalPaid);
    const interestRemaining = Math.max(0, split.interestDue - split.interestPaid);

    let principalComponentPaise = 0;
    let interestComponentPaise = 0;
    let nextInstallmentStatus = row.installment_status;
    let nextPaidPaise = paidPaise;
    let nextMetadata = { ...split.metadata };

    if (isWriteoff) {
      nextInstallmentStatus = 'BAD_DEBT';
      nextMetadata = {
        ...nextMetadata,
        split_method: nextMetadata.split_method || 'INTEREST_FIRST_EMI_SPLIT',
        principal_due: fromPaise(split.principalDue),
        interest_due: fromPaise(split.interestDue),
        principal_paid: fromPaise(split.principalPaid),
        interest_paid: fromPaise(split.interestPaid),
        writeoff_amount: fromPaise(amountPaise),
        writeoff_at: collectionDate.toISOString(),
      };
    } else {
      // Accounting policy: allocate collected amount to interest first, then principal.
      let left = amountPaise;
      interestComponentPaise = Math.min(left, interestRemaining); left -= interestComponentPaise;
      principalComponentPaise = Math.min(left, principalRemaining); left -= principalComponentPaise;
      if (left > 0) {
        const principalExtra = Math.min(left, Math.max(0, principalRemaining - principalComponentPaise));
        principalComponentPaise += principalExtra; left -= principalExtra;
      }
      if (left > 0) {
        const interestExtra = Math.min(left, Math.max(0, interestRemaining - interestComponentPaise));
        interestComponentPaise += interestExtra; left -= interestExtra;
      }

      nextPaidPaise = paidPaise + amountPaise;
      nextInstallmentStatus = nextPaidPaise >= scheduledPaise ? 'PAID' : 'PARTIAL';
      nextMetadata = {
        ...nextMetadata,
        split_method: 'INTEREST_FIRST_EMI_SPLIT',
        principal_due: fromPaise(split.principalDue),
        interest_due: fromPaise(split.interestDue),
        principal_paid: fromPaise(split.principalPaid + principalComponentPaise),
        interest_paid: fromPaise(split.interestPaid + interestComponentPaise),
      };
    }

    const collectionInsert = await query(
      `
      insert into collections (
        organization_id, loan_id, installment_id, client_id, amount,
        cash_received_amount, tds_deducted_amount,
        principal_component, interest_component, split_method,
        collection_date, payment_mode, receipt_number, is_partial, is_writeoff, notes,
        agent_user_id, idempotency_key, source_device_id, created_by
      ) values (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20
      )
      returning *
      `,
      [
        orgId,
        row.loan_id,
        row.installment_id,
        row.client_id,
        fromPaise(amountPaise),
        fromPaise(cashReceivedAmountPaise),
        fromPaise(tdsDeductedAmountPaise),
        isWriteoff ? null : fromPaise(principalComponentPaise),
        isWriteoff ? null : fromPaise(interestComponentPaise),
        isWriteoff ? null : 'INTEREST_FIRST_EMI_SPLIT',
        collectionDate.toISOString(),
        paymentMode,
        receiptNumber,
        !isWriteoff && amountPaise < outstandingPaise,
        isWriteoff,
        notes,
        agentUserId,
        idempotencyKey ? String(idempotencyKey) : null,
        sourceDeviceId,
        userId,
      ],
      client
    );
    const collection = collectionInsert.rows[0];

    let tdsEntry = null;
    if (!isWriteoff && tdsDeductedAmountPaise > 0) {
      const deductionDate = collectionDate.toISOString().slice(0, 10);
      const fundingChannel = ['DIRECT', 'TIE_UP'].includes(String(tdsFundingChannelInput || ''))
        ? tdsFundingChannelInput
        : String(row.client_funding_channel || 'DIRECT').toUpperCase();
      const tieUpPartnerName = (tdsTieUpPartnerNameInput != null)
        ? tdsTieUpPartnerNameInput
        : (row.client_tie_up_partner_name || null);
      const sourceType = (() => {
        if (['CLIENT_COLLECTION', 'TIE_UP_SETTLEMENT', 'MANUAL'].includes(tdsSourceTypeInput)) return tdsSourceTypeInput;
        if (fundingChannel === 'TIE_UP' && tieUpPartnerName) return 'TIE_UP_SETTLEMENT';
        return 'CLIENT_COLLECTION';
      })();
      const insertTds = await query(
        `
        insert into client_tds_entries (
          organization_id, client_id, loan_id, collection_id, deduction_date, period_month,
          gross_emi_amount, cash_received_amount, tds_amount,
          receipt_status, received_date, certificate_ref, source_type,
          client_funding_channel_snapshot, tie_up_partner_name_snapshot, notes, created_by
        ) values (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,
          $10,$11,$12,$13,
          $14,$15,$16,$17
        )
        returning *
        `,
        [
          orgId,
          row.client_id,
          row.loan_id,
          collection.id,
          deductionDate,
          monthFromDate(deductionDate),
          fromPaise(amountPaise),
          fromPaise(cashReceivedAmountPaise),
          fromPaise(tdsDeductedAmountPaise),
          tdsReceiptStatus,
          tdsReceiptStatus === 'RECEIVED' ? asDateOnly(tdsReceivedDate || deductionDate, 'tdsReceivedDate') : null,
          tdsCertificateRef,
          sourceType,
          fundingChannel,
          fundingChannel === 'TIE_UP' ? (tieUpPartnerName || null) : null,
          tdsNotes,
          userId,
        ],
        client
      );
      tdsEntry = insertTds.rows[0] || null;
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
      [
        orgId,
        row.installment_id,
        row.loan_id,
        fromPaise(nextPaidPaise),
        nextInstallmentStatus,
        collectionDate.toISOString(),
        collection.id,
        JSON.stringify(nextMetadata),
      ],
      client
    );

    await query(
      `
      insert into ledger_entries (
        organization_id, entry_time, tx_type, tag, amount, description,
        client_id, loan_id, collection_id, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        orgId,
        collectionDate.toISOString(),
        isWriteoff ? 'DEBIT' : 'CREDIT',
        isWriteoff ? 'BAD_DEBT' : 'COLLECTION',
        fromPaise(isWriteoff ? amountPaise : cashReceivedAmountPaise),
        `${isWriteoff ? 'Write-off' : 'Collection'} — ${row.client_name}`,
        row.client_id,
        row.loan_id,
        collection.id,
        userId,
      ],
      client
    );

    const remainingRes = await query(
      `
      select count(*)::int as remaining_pending
      from installments
      where organization_id = $1 and loan_id = $2 and status in ('PENDING','PARTIAL')
      `,
      [orgId, row.loan_id],
      client
    );
    const remainingPending = Number(remainingRes.rows[0]?.remaining_pending || 0);
    let loanStatus = row.loan_status;
    if (remainingPending === 0 && row.loan_status !== 'CLOSED') {
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
    }

    await query(
      `
      insert into audit_logs (
        organization_id, actor_user_id, entity_type, entity_id, action, metadata, after_data
      ) values (
        $1,$2,'collection',$3,$4,$5::jsonb,$6::jsonb
      )
      `,
      [
        orgId,
        userId,
        collection.id,
        isWriteoff ? 'RECORD_WRITE_OFF' : 'RECORD_COLLECTION',
        JSON.stringify({
          loanId: row.loan_id,
          installmentId: row.installment_id,
          splitMethod: isWriteoff ? null : 'INTEREST_FIRST_EMI_SPLIT',
          grossSettlementAmount: fromPaise(amountPaise),
          cashReceivedAmount: isWriteoff ? 0 : fromPaise(cashReceivedAmountPaise),
          tdsDeductedAmount: isWriteoff ? 0 : fromPaise(tdsDeductedAmountPaise),
        }),
        JSON.stringify({
          amount: fromPaise(amountPaise),
          cashReceivedAmount: isWriteoff ? 0 : fromPaise(cashReceivedAmountPaise),
          tdsDeductedAmount: isWriteoff ? 0 : fromPaise(tdsDeductedAmountPaise),
          principalComponent: isWriteoff ? null : fromPaise(principalComponentPaise),
          interestComponent: isWriteoff ? null : fromPaise(interestComponentPaise),
          installmentStatus: nextInstallmentStatus,
          loanStatus,
        }),
      ],
      client
    );

    const responseRow = await query(
      `
      select co.*, c.name as client_name, l.loan_number, i.installment_no
      from collections co
      join clients c on c.id = co.client_id and c.organization_id = co.organization_id
      left join loans l on l.id = co.loan_id and l.organization_id = co.organization_id
      left join installments i on i.id = co.installment_id and i.organization_id = co.organization_id
      where co.organization_id = $1 and co.id = $2
      `,
      [orgId, collection.id],
      client
    );

    return {
      item: responseRow.rows[0],
      reused: false,
      installment: {
        id: row.installment_id,
        installmentNo: row.installment_no,
        status: nextInstallmentStatus,
        scheduledAmount: Number(row.scheduled_amount),
        paidAmount: fromPaise(nextPaidPaise),
        outstandingAmount: isWriteoff ? 0 : Math.max(0, fromPaise(scheduledPaise - nextPaidPaise)),
      },
      loan: {
        id: row.loan_id,
        loanNumber: row.loan_number,
        status: loanStatus,
      },
      postedSplit: isWriteoff ? null : {
        principalComponent: fromPaise(principalComponentPaise),
        interestComponent: fromPaise(interestComponentPaise),
        splitMethod: 'INTEREST_FIRST_EMI_SPLIT',
      },
      settlement: {
        grossAmount: fromPaise(amountPaise),
        cashReceivedAmount: isWriteoff ? 0 : fromPaise(cashReceivedAmountPaise),
        tdsDeductedAmount: isWriteoff ? 0 : fromPaise(tdsDeductedAmountPaise),
      },
      tds: tdsEntry ? {
        id: tdsEntry.id,
        tdsAmount: Number(tdsEntry.tds_amount),
        receiptStatus: tdsEntry.receipt_status,
        fundingChannel: tdsEntry.client_funding_channel_snapshot,
        tieUpPartnerName: tdsEntry.tie_up_partner_name_snapshot,
      } : null,
    };
  });

  res.status(result.reused ? 200 : 201).json(result);
}));

module.exports = router;
