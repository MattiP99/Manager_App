import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('note_sections/notes RLS isolation, bootstrap, and constraints', () => {
  const password = 'Test1234!';
  const userAEmail = `notes-test-a-${Date.now()}@example.com`;
  const userBEmail = `notes-test-b-${Date.now()}@example.com`;
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

  it('create_household bootstraps exactly the 3 default sections with correct title/type/sort_order', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Bootstrap Test' });
    createdHouseholdIds.push(household.id);

    const { data: sections, error } = await clientA
      .from('note_sections')
      .select('title, type, sort_order')
      .eq('household_id', household.id)
      .order('sort_order', { ascending: true });

    expect(error).toBeNull();
    expect(sections).toEqual([
      { title: 'Info importanti', type: 'info', sort_order: 0 },
      { title: 'Info secondarie', type: 'info', sort_order: 1 },
      { title: 'Password', type: 'password', sort_order: 2 },
    ]);
  });

  it('a user cannot see or write note_sections/notes from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Notes Isolation Test' });
    createdHouseholdIds.push(householdA.id);

    const { data: infoSection } = await clientA
      .from('note_sections')
      .select('id')
      .eq('household_id', householdA.id)
      .eq('type', 'info')
      .limit(1)
      .single();
    const infoSectionId = infoSection!.id;

    await clientA.from('notes').insert({
      household_id: householdA.id,
      section_id: infoSectionId,
      title: 'Segreto A',
      content: 'contenuto di A',
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleSections } = await clientB
      .from('note_sections')
      .select('*')
      .eq('household_id', householdA.id);
    const { data: visibleNotes } = await clientB
      .from('notes')
      .select('*')
      .eq('household_id', householdA.id);

    expect(visibleSections).toEqual([]);
    expect(visibleNotes).toEqual([]);

    const insertAttempt = await clientB.from('notes').insert({
      household_id: householdA.id,
      section_id: infoSectionId,
      title: 'Sneaky',
      content: 'intrusione',
    });
    expect(insertAttempt.error).not.toBeNull();
  });

  it('a user can fully manage note_sections and notes in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Notes CRUD Test' });
    createdHouseholdIds.push(household.id);

    const { data: customSection, error: createSectionError } = await clientA
      .from('note_sections')
      .insert({ household_id: household.id, title: 'Ricette', type: 'custom', sort_order: 3 })
      .select()
      .single();
    expect(createSectionError).toBeNull();

    const { data: note, error: createNoteError } = await clientA
      .from('notes')
      .insert({ household_id: household.id, section_id: customSection.id, title: 'Torta', content: 'farina, uova, zucchero' })
      .select()
      .single();
    expect(createNoteError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('notes')
      .update({ content: 'farina, uova, zucchero, cioccolato' })
      .eq('id', note.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.content).toBe('farina, uova, zucchero, cioccolato');

    const { error: deleteError } = await clientA.from('notes').delete().eq('id', note.id);
    expect(deleteError).toBeNull();
  });

  it('rejects a note with both content and content_encrypted set, or neither', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Content Check Test' });
    createdHouseholdIds.push(household.id);

    const { data: infoSection } = await clientA
      .from('note_sections')
      .select('id')
      .eq('household_id', household.id)
      .eq('type', 'info')
      .limit(1)
      .single();
    const infoSectionId = infoSection!.id;

    const bothSet = await clientA
      .from('notes')
      .insert({ household_id: household.id, section_id: infoSectionId, title: 'Both', content: 'a', content_encrypted: 'b' });
    expect(bothSet.error).not.toBeNull();

    const neitherSet = await clientA
      .from('notes')
      .insert({ household_id: household.id, section_id: infoSectionId, title: 'Neither' });
    expect(neitherSet.error).not.toBeNull();

    const exactlyOne = await clientA
      .from('notes')
      .insert({ household_id: household.id, section_id: infoSectionId, title: 'Valid', content: 'ok' });
    expect(exactlyOne.error).toBeNull();
  });
});
