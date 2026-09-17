import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('clients/work_sessions/payments RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `clients-test-a-${Date.now()}@example.com`;
  const userBEmail = `clients-test-b-${Date.now()}@example.com`;
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

  it('a user cannot see clients, work sessions, or payments from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Clients Test',
    });
    createdHouseholdIds.push(householdA.id);

    const { data: newClient, error: clientError } = await clientA
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Mario Rossi', hourly_rate: 12 })
      .select()
      .single();
    expect(clientError).toBeNull();

    await clientA.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-01',
      hours: 3,
      rate_snapshot: 12,
    });
    await clientA.from('payments').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-05',
      amount: 20,
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleClients } = await clientB.from('clients').select('*').eq('household_id', householdA.id);
    const { data: visibleSessions } = await clientB
      .from('work_sessions')
      .select('*')
      .eq('household_id', householdA.id);
    const { data: visiblePayments } = await clientB
      .from('payments')
      .select('*')
      .eq('household_id', householdA.id);

    expect(visibleClients).toEqual([]);
    expect(visibleSessions).toEqual([]);
    expect(visiblePayments).toEqual([]);
  });

  it('a user cannot insert into another household\'s clients, work sessions, or payments', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Write Test',
    });
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);

    const insertClient = await clientB
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Sneaky', hourly_rate: 10 });
    expect(insertClient.error).not.toBeNull();

    const insertSession = await clientB.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: '00000000-0000-0000-0000-000000000000',
      date: '2026-09-01',
      hours: 1,
      rate_snapshot: 10,
    });
    expect(insertSession.error).not.toBeNull();

    const insertPayment = await clientB
      .from('payments')
      .insert({ household_id: householdA.id, client_id: '00000000-0000-0000-0000-000000000000', date: '2026-09-01', amount: 10 });
    expect(insertPayment.error).not.toBeNull();
  });

  it('a user can fully manage clients in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A CRUD Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: created, error: createError } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'Anna Bianchi', hourly_rate: 15 })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('clients')
      .update({ hourly_rate: 16 })
      .eq('id', created.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.hourly_rate).toBe(16);

    const { error: deleteError } = await clientA.from('clients').delete().eq('id', created.id);
    expect(deleteError).toBeNull();
  });

  it('work_session_status computes FIFO paid/unpaid status correctly', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A FIFO Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: client } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'FIFO Client', hourly_rate: 10 })
      .select()
      .single();

    const { data: day1 } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: client.id, date: '2026-09-01', hours: 2, rate_snapshot: 10 })
      .select()
      .single();
    const { data: day2 } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: client.id, date: '2026-09-08', hours: 2, rate_snapshot: 10 })
      .select()
      .single();

    // amount_due per giornata = 20. Un pagamento di 20 deve coprire solo day1 (il più vecchio).
    await clientA.from('payments').insert({ household_id: household.id, client_id: client.id, date: '2026-09-02', amount: 20 });

    const { data: statusAfterPartial } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    expect(statusAfterPartial!.find((s) => s.id === day1.id)!.status).toBe('paid');
    expect(statusAfterPartial!.find((s) => s.id === day2.id)!.status).toBe('unpaid');

    // Un secondo pagamento di 20 copre anche day2.
    await clientA.from('payments').insert({ household_id: household.id, client_id: client.id, date: '2026-09-09', amount: 20 });

    const { data: statusAfterFull } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    expect(statusAfterFull!.find((s) => s.id === day1.id)!.status).toBe('paid');
    expect(statusAfterFull!.find((s) => s.id === day2.id)!.status).toBe('paid');
  });
});
