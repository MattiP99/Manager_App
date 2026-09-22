import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('expenses RLS isolation and constraints', () => {
  const password = 'Test1234!';
  const userAEmail = `expenses-test-a-${Date.now()}@example.com`;
  const userBEmail = `expenses-test-b-${Date.now()}@example.com`;
  let userAId: string;
  let userBId: string;
  const createdHouseholdIds: string[] = [];

  beforeAll(async () => {
    const userA = await createTestUser(userAEmail, password);
    const userB = await createTestUser(userBEmail, password);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await admin.from('households').delete().in('id', createdHouseholdIds);
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it('create_household bootstraps exactly the 4 default expense categories with correct slug/label/sort_order', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Expense Categories Bootstrap Test' });
    createdHouseholdIds.push(household.id);

    const { data: categories, error } = await clientA
      .from('expense_categories')
      .select('slug, label, sort_order')
      .eq('household_id', household.id)
      .order('sort_order', { ascending: true });

    expect(error).toBeNull();
    expect(categories).toEqual([
      { slug: 'supermercato', label: 'Supermercato', sort_order: 0 },
      { slug: 'frutta_verdura', label: 'Frutta e verdura', sort_order: 1 },
      { slug: 'extra', label: 'Extra', sort_order: 2 },
      { slug: 'francesca', label: 'Francesca', sort_order: 3 },
    ]);
  });

  it('a user cannot see or write expense_categories from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Expense Categories Isolation Test' });
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleCategories } = await clientB
      .from('expense_categories')
      .select('*')
      .eq('household_id', householdA.id);
    expect(visibleCategories).toEqual([]);

    const insertAttempt = await clientB
      .from('expense_categories')
      .insert({ household_id: householdA.id, label: 'Intrusione' });
    expect(insertAttempt.error).not.toBeNull();
  });

  it('a user can create a custom expense category and log an expense against it', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Custom Category Test' });
    createdHouseholdIds.push(household.id);

    const { data: category, error: createError } = await clientA
      .from('expense_categories')
      .insert({ household_id: household.id, label: 'Casa', sort_order: 4 })
      .select('id, slug, label')
      .single();
    expect(createError).toBeNull();
    expect(category!.label).toBe('Casa');
    expect(category!.slug).toBeTruthy(); // generato dal default DB, mai passato dal client

    const { error: expenseError } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: category!.slug, amount: 30, date: '2026-09-20' });
    expect(expenseError).toBeNull();
  });

  it('a user cannot see or write expenses from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Expenses Test' });
    createdHouseholdIds.push(householdA.id);

    const { error: insertError } = await clientA
      .from('expenses')
      .insert({ household_id: householdA.id, category: 'supermercato', amount: 42.5, date: '2026-09-20' });
    expect(insertError).toBeNull();

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleExpenses } = await clientB
      .from('expenses')
      .select('*')
      .eq('household_id', householdA.id);
    expect(visibleExpenses).toEqual([]);

    const insertAttempt = await clientB
      .from('expenses')
      .insert({ household_id: householdA.id, category: 'extra', amount: 10, date: '2026-09-20' });
    expect(insertAttempt.error).not.toBeNull();
  });

  it('a user can fully manage expenses in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Expenses CRUD Test' });
    createdHouseholdIds.push(household.id);

    const { data: expense, error: createError } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'extra', label: 'Idraulico', amount: 80, date: '2026-09-15' })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('expenses')
      .update({ amount: 95 })
      .eq('id', expense.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.amount).toBe(95);

    const { error: deleteError } = await clientA.from('expenses').delete().eq('id', expense.id);
    expect(deleteError).toBeNull();
  });

  it('rejects a category outside the allowed list', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Category Check Test' });
    createdHouseholdIds.push(household.id);

    const { error } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'benzina', amount: 10, date: '2026-09-15' });
    expect(error).not.toBeNull();
  });

  it('rejects category=francesca without francesca_activity, and francesca_activity set on a non-francesca category', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Cross-Check Test' });
    createdHouseholdIds.push(household.id);

    const missingActivity = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'francesca', amount: 10, date: '2026-09-15' });
    expect(missingActivity.error).not.toBeNull();

    const misplacedActivity = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'supermercato', francesca_activity: 'piscina', amount: 10, date: '2026-09-15' });
    expect(misplacedActivity.error).not.toBeNull();

    const valid = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'francesca', francesca_activity: 'piscina', amount: 10, date: '2026-09-15' });
    expect(valid.error).toBeNull();
  });

  it('rejects a non-positive amount', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Amount Check Test' });
    createdHouseholdIds.push(household.id);

    const { error } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'supermercato', amount: 0, date: '2026-09-15' });
    expect(error).not.toBeNull();
  });
});
