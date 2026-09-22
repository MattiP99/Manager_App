import { FAMILY_CATEGORIES } from '../family-calendar/constants';

// EXPENSE_CATEGORIES (elenco statico) rimosso da migrazione 0013 — le
// categorie sono ora per-famiglia, caricate via useExpenseCategories().

// Le 6 attività di Francesca (incluso 'altro', vedi migrazione 0012)
// coincidono esattamente con FamilyCategory — stesso elenco del Calendario,
// nessun filtro/cast necessario.
export const FRANCESCA_ACTIVITIES = FAMILY_CATEGORIES;
