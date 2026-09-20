-- Aggiorna work_session_status per includere start_time/end_time (aggiunti
-- a work_sessions dalla migrazione 0009) — un `select ws.*` in una view
-- Postgres espande le colonne al momento della creazione, non
-- dinamicamente: va ricreata esplicitamente dopo un ALTER TABLE.
-- CREATE OR REPLACE VIEW non basta qui: le nuove colonne di ws.* finirebbero
-- in mezzo alla lista (prima di cumulative_due/total_paid/status), non in
-- coda, il che Postgres non permette con REPLACE — serve drop + create.

drop view work_session_status;

create view work_session_status
  with (security_invoker = true)
as
select
  ws.*,
  sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at, ws.id) as cumulative_due,
  coalesce(p.total_paid, 0) as total_paid,
  case
    when sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at, ws.id)
         <= coalesce(p.total_paid, 0)
    then 'paid' else 'unpaid'
  end as status
from work_sessions ws
left join (
  select client_id, sum(amount) as total_paid from payments group by client_id
) p on p.client_id = ws.client_id;
