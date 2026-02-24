-- Allow partner-level cumulative TDS entries (no single client/loan/collection mapping)

alter table client_tds_entries
  alter column client_id drop not null;

-- Optional: ensure tie-up monthly settlements can exist without client mapping
-- and still retain partner snapshot + source_type in row.
