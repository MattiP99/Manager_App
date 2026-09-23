import { createClient } from '@supabase/supabase-js';
import { adminClient as admin, createTestUser, signInAs } from './helpers';

const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

/** Stabilisce una sessione "di recupero" reale (stesso meccanismo del link email: admin.generateLink + verifyOtp), senza inviare nessuna vera email — verificato empiricamente 2026-09-23 che questo produce un access token con amr = [{"method":"otp",...}], lo stesso claim che la policy RLS di note_section_recovery controlla. */
async function signInAsRecovery(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (linkErr) throw linkErr;
  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error('generateLink did not return a hashed_token');

  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const { error: verifyErr } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (verifyErr) throw verifyErr;
  return client;
}

describe('note_section_recovery RLS: escrow readable only during a recovery session', () => {
  const password = 'Test1234!';
  const userAEmail = `recovery-test-a-${Date.now()}@example.com`;
  const userBEmail = `recovery-test-b-${Date.now()}@example.com`;
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

  async function setUpHouseholdWithRecoveryRow(clientA: Awaited<ReturnType<typeof signInAs>>) {
    const { data: household } = await clientA.rpc('create_household', {
      p_name: `Household Recovery Test ${Date.now()}`,
    });
    createdHouseholdIds.push(household.id);

    const { data: passwordSection } = await clientA
      .from('note_sections')
      .select('id')
      .eq('household_id', household.id)
      .eq('type', 'password')
      .single();

    const { error: insertError } = await clientA.from('note_section_recovery').insert({
      section_id: passwordSection!.id,
      household_id: household.id,
      recovery_key_hex: 'ab'.repeat(32),
    });
    expect(insertError).toBeNull();

    return { householdId: household.id, sectionId: passwordSection!.id };
  }

  it('a normal (password) session cannot read its own household recovery row', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { sectionId } = await setUpHouseholdWithRecoveryRow(clientA);

    const { data, error } = await clientA
      .from('note_section_recovery')
      .select('recovery_key_hex')
      .eq('section_id', sectionId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a recovery session (opened via the email link mechanism) can read its own household recovery row', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { sectionId } = await setUpHouseholdWithRecoveryRow(clientA);

    const recoveryClientA = await signInAsRecovery(userAEmail);
    const { data, error } = await recoveryClientA
      .from('note_section_recovery')
      .select('recovery_key_hex')
      .eq('section_id', sectionId)
      .single();

    expect(error).toBeNull();
    expect(data?.recovery_key_hex).toBe('ab'.repeat(32));
  });

  it('a recovery session cannot read another household’s recovery row', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { sectionId } = await setUpHouseholdWithRecoveryRow(clientA);

    const recoveryClientB = await signInAsRecovery(userBEmail);
    const { data, error } = await recoveryClientB
      .from('note_section_recovery')
      .select('recovery_key_hex')
      .eq('section_id', sectionId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a normal session cannot write a recovery row for another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: `Household Recovery Isolation Test ${Date.now()}`,
    });
    createdHouseholdIds.push(household.id);
    const { data: passwordSection } = await clientA
      .from('note_sections')
      .select('id')
      .eq('household_id', household.id)
      .eq('type', 'password')
      .single();

    const clientB = await signInAs(userBEmail, password);
    const { error } = await clientB.from('note_section_recovery').insert({
      section_id: passwordSection!.id,
      household_id: household.id,
      recovery_key_hex: 'cd'.repeat(32),
    });

    expect(error).not.toBeNull();
  });
});
