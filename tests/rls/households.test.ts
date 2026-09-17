import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('household RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `rls-test-a-${Date.now()}@example.com`;
  const userBEmail = `rls-test-b-${Date.now()}@example.com`;
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

  it('a user cannot see a household they are not a member of', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA, error: createError } = await clientA.rpc('create_household', {
      p_name: 'Household A',
    });
    expect(createError).toBeNull();
    expect(householdA.id).toBeDefined();
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleToB, error: selectError } = await clientB
      .from('households')
      .select('*')
      .eq('id', householdA.id);

    expect(selectError).toBeNull();
    expect(visibleToB).toEqual([]);
  });

  it('a user can join a household via invite code and then see it', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Join Test',
    });
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);
    const { data: joined, error: joinError } = await clientB.rpc('join_household', {
      p_code: householdA.invite_code,
    });
    expect(joinError).toBeNull();
    expect(joined.id).toBe(householdA.id);

    const { data: visibleToB } = await clientB.from('households').select('*').eq('id', householdA.id);
    expect(visibleToB).toHaveLength(1);
  });

  it('join_household rejects an invalid invite code', async () => {
    const clientB = await signInAs(userBEmail, password);
    const { error } = await clientB.rpc('join_household', { p_code: 'ZZZZZZ' });
    expect(error).not.toBeNull();
  });

  it('a user cannot write directly to households or household_members (only the RPCs can)', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Write Test',
    });
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);

    const insertMembership = await clientB
      .from('household_members')
      .insert({ household_id: householdA.id, user_id: userBId });
    expect(insertMembership.error).not.toBeNull();

    const insertHousehold = await clientB
      .from('households')
      .insert({ name: 'Sneaky', invite_code: 'ZZZZZZ' });
    expect(insertHousehold.error).not.toBeNull();

    // UPDATE/DELETE on a table with RLS enabled and no matching policy don't
    // error (only INSERT's WITH CHECK does that) — they silently match zero
    // rows. So the real assertion is "zero rows affected" (.select() echoes
    // back the affected rows) plus proof the row is untouched afterward.
    const updateHousehold = await clientB
      .from('households')
      .update({ name: 'Hijacked' })
      .eq('id', householdA.id)
      .select();
    expect(updateHousehold.error).toBeNull();
    expect(updateHousehold.data).toEqual([]);

    const deleteHousehold = await clientB
      .from('households')
      .delete()
      .eq('id', householdA.id)
      .select();
    expect(deleteHousehold.error).toBeNull();
    expect(deleteHousehold.data).toEqual([]);

    const { data: stillIntact } = await clientA
      .from('households')
      .select('*')
      .eq('id', householdA.id);
    expect(stillIntact).toHaveLength(1);
    expect(stillIntact![0].name).toBe('Household A Write Test');
  });
});
