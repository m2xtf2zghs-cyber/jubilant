-- Support short-receipt collections where TDS is deducted.
-- `collections.amount` remains the gross settlement amount (used for installment settlement / split).
-- `cash_received_amount` is the actual cash credited; `tds_deducted_amount` is tracked separately.

alter table collections
  add column if not exists cash_received_amount numeric(14,2);

alter table collections
  add column if not exists tds_deducted_amount numeric(14,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_collections_cash_received_amount_non_negative'
  ) then
    alter table collections
      add constraint chk_collections_cash_received_amount_non_negative
      check (cash_received_amount is null or cash_received_amount >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_collections_tds_deducted_amount_non_negative'
  ) then
    alter table collections
      add constraint chk_collections_tds_deducted_amount_non_negative
      check (tds_deducted_amount >= 0);
  end if;
end $$;

-- Backfill historical rows (no TDS tracking) so cash amount equals collection amount.
update collections
set cash_received_amount = amount
where cash_received_amount is null;

-- Ensure future rows always have a cash amount.
alter table collections
  alter column cash_received_amount set not null;

