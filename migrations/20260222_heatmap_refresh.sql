-- Heatmap refresh function for scheduler/cron trigger.
-- Intended caller: backend service role via protected API route.

create or replace function refresh_heatmap_cells_5m()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view heatmap_cells_5m;
end;
$$;

