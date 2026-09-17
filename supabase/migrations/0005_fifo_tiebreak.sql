-- work_session_status's FIFO cumulative sum had no fully deterministic row
-- order: date + created_at can still tie (multiple sessions inserted in the
-- same transaction). Add ws.id as a final tiebreak.

create or replace view work_session_status
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
