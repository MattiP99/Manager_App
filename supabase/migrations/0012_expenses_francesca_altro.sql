-- Aggiunge 'altro' come attività valida per le spese di categoria
-- 'francesca' — riusa il valore 'altro' già esistente in FamilyCategory
-- (calendario/impegni ricorrenti), non introduce un nuovo tipo separato.
-- Prima escluso deliberatamente (vedi expenseSummary.ts,
-- FrancescaActivity = Exclude<FamilyCategory, 'altro'>) perché non c'era
-- un caso d'uso; ora c'è, su richiesta esplicita dell'utente.

alter table expenses drop constraint expenses_francesca_activity_check;

alter table expenses add constraint expenses_francesca_activity_check
  check (francesca_activity in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro', 'altro'));
