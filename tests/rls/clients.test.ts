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

    const { error: sessionSetupError } = await clientA.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-01',
      hours: 3,
      rate_snapshot: 12,
    });
    expect(sessionSetupError).toBeNull();
    const { error: paymentSetupError } = await clientA.from('payments').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-05',
      amount: 20,
    });
    expect(paymentSetupError).toBeNull();

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

    const { data: realClient, error: realClientError } = await clientA
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Real Client', hourly_rate: 10 })
      .select()
      .single();
    expect(realClientError).toBeNull();

    const clientB = await signInAs(userBEmail, password);

    const insertClient = await clientB
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Sneaky', hourly_rate: 10 });
    expect(insertClient.error).not.toBeNull();

    // Uses a real client_id (belonging to household A) so a denial here can
    // only be RLS blocking the cross-household write, not an FK violation.
    const insertSession = await clientB.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: realClient.id,
      date: '2026-09-01',
      hours: 1,
      rate_snapshot: 10,
    });
    expect(insertSession.error).not.toBeNull();

    const insertPayment = await clientB
      .from('payments')
      .insert({ household_id: householdA.id, client_id: realClient.id, date: '2026-09-01', amount: 10 });
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

    // Overpayment: a payment larger than total remaining due should mark
    // every session 'paid', not error or leave anything unpaid.
    await clientA.from('payments').insert({ household_id: household.id, client_id: client.id, date: '2026-09-10', amount: 1000 });

    const { data: statusAfterOverpayment } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    expect(statusAfterOverpayment!.every((s) => s.status === 'paid')).toBe(true);
  });

  it('a payment for one client does not affect work_session_status for another client', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A Cross-Client Isolation Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: clientX } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'Client X', hourly_rate: 10 })
      .select()
      .single();
    const { data: clientY } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'Client Y', hourly_rate: 10 })
      .select()
      .single();

    const { data: sessionX } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: clientX.id, date: '2026-09-01', hours: 2, rate_snapshot: 10 })
      .select()
      .single();
    const { data: sessionY } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: clientY.id, date: '2026-09-01', hours: 2, rate_snapshot: 10 })
      .select()
      .single();

    // Fully pay client X only.
    await clientA.from('payments').insert({ household_id: household.id, client_id: clientX.id, date: '2026-09-02', amount: 20 });

    const { data: statusX } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', clientX.id);
    const { data: statusY } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', clientY.id);

    expect(statusX!.find((s) => s.id === sessionX.id)!.status).toBe('paid');
    expect(statusY!.find((s) => s.id === sessionY.id)!.status).toBe('unpaid');
  });

  it('a cross-household UPDATE or DELETE on a client is silently denied (no rows matched, owner data unchanged)', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A Write-Denial Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: ownedClient } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'Owned Client', hourly_rate: 12 })
      .select()
      .single();

    const clientB = await signInAs(userBEmail, password);

    // Cross-household UPDATE matches zero rows under RLS — no error, but
    // also no effect. Confirm the owner still sees the original value.
    await clientB.from('clients').update({ hourly_rate: 999 }).eq('id', ownedClient.id);
    const { data: afterUpdateAttempt } = await clientA.from('clients').select('hourly_rate').eq('id', ownedClient.id).single();
    expect(afterUpdateAttempt!.hourly_rate).toBe(12);

    // Cross-household DELETE likewise matches zero rows — the row must
    // still be present when the owner reads it back.
    await clientB.from('clients').delete().eq('id', ownedClient.id);
    const { data: afterDeleteAttempt } = await clientA.from('clients').select('id').eq('id', ownedClient.id).single();
    expect(afterDeleteAttempt!.id).toBe(ownedClient.id);
  });
});
