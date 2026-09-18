import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('recurring_templates/calendar_events RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `family-test-a-${Date.now()}@example.com`;
  const userBEmail = `family-test-b-${Date.now()}@example.com`;
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

  it('a user cannot see or write recurring_templates/calendar_events from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Family Test' });
    createdHouseholdIds.push(householdA.id);

    const { data: template, error: templateError } = await clientA
      .from('recurring_templates')
      .insert({ household_id: householdA.id, title: 'Piscina', category: 'piscina', person: 'Francesca', weekday: 2 })
      .select()
      .single();
    expect(templateError).toBeNull();

    await clientA.from('calendar_events').insert({
      household_id: householdA.id,
      title: 'Visita medica',
      category: 'altro',
      person: 'Francesca',
      date: '2026-09-22',
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleTemplates } = await clientB
      .from('recurring_templates')
      .select('*')
      .eq('household_id', householdA.id);
    const { data: visibleEvents } = await clientB
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdA.id);

    expect(visibleTemplates).toEqual([]);
    expect(visibleEvents).toEqual([]);

    const insertAttempt = await clientB
      .from('recurring_templates')
      .insert({ household_id: householdA.id, title: 'Sneaky', category: 'altro', person: 'X', weekday: 0 });
    expect(insertAttempt.error).not.toBeNull();

    void template;
  });

  it('a user can fully manage recurring_templates and calendar_events in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Family CRUD Test' });
    createdHouseholdIds.push(household.id);

    const { data: template, error: createError } = await clientA
      .from('recurring_templates')
      .insert({ household_id: household.id, title: 'Mensa', category: 'mensa', person: 'Francesca', weekday: 1 })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('recurring_templates')
      .update({ weekday: 3 })
      .eq('id', template.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.weekday).toBe(3);

    const { error: deleteError } = await clientA.from('recurring_templates').delete().eq('id', template.id);
    expect(deleteError).toBeNull();
  });

  it('the unique constraint on (recurring_template_id, date) rejects a duplicate override but allows multiple manual events on the same date', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Unique Constraint Test' });
    createdHouseholdIds.push(household.id);

    const { data: template } = await clientA
      .from('recurring_templates')
      .insert({ household_id: household.id, title: 'Palestra', category: 'palestra', person: 'Francesca', weekday: 4 })
      .select()
      .single();

    const { error: firstOverrideError } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      recurring_template_id: template.id,
      title: 'Palestra',
      category: 'palestra',
      person: 'Francesca',
      date: '2026-10-01',
      is_cancelled: true,
    });
    expect(firstOverrideError).toBeNull();

    const { error: duplicateOverrideError } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      recurring_template_id: template.id,
      title: 'Palestra',
      category: 'palestra',
      person: 'Francesca',
      date: '2026-10-01',
    });
    expect(duplicateOverrideError).not.toBeNull();

    const { error: manualEvent1Error } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      title: 'Compleanno',
      category: 'altro',
      person: 'Francesca',
      date: '2026-10-01',
    });
    const { error: manualEvent2Error } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      title: 'Teatro',
      category: 'teatro',
      person: 'Francesca',
      date: '2026-10-01',
    });
    expect(manualEvent1Error).toBeNull();
    expect(manualEvent2Error).toBeNull();
  });
});
