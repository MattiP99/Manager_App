export type NoteSectionType = 'info' | 'password' | 'custom';

export interface NoteSection {
  id: string;
  title: string;
  type: NoteSectionType;
  sort_order: number;
  encryption_salt: string | null;
  encryption_wrapped_key: string | null;
  encryption_canary: string | null;
}

export interface Note {
  id: string;
  section_id: string;
  title: string;
  content: string | null;
  content_encrypted: string | null;
  created_at: string;
}
