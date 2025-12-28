export type TutorDialogueEntry = {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  slideId?: string;
  slideTitle?: string;
  mode?: 'text' | 'avatar';
};

const STORAGE_KEY = 'tutorDialogueLog';
const MAX_ENTRIES = 500;
const UPSERT_WINDOW_MS = 4000;

const readLog = (): TutorDialogueEntry[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendTutorDialogue = (entry: TutorDialogueEntry) => {
  if (!entry?.content || !entry.content.trim()) return;
  const timestamp = entry.timestamp ?? Date.now();
  const existing = readLog();
  const next = [...existing, { ...entry, timestamp }].slice(-MAX_ENTRIES);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const upsertTutorDialogue = (entry: TutorDialogueEntry) => {
  if (!entry?.content || !entry.content.trim()) return;
  const timestamp = entry.timestamp ?? Date.now();
  const existing = readLog();
  const last = existing[existing.length - 1];

  if (
    last &&
    last.role === entry.role &&
    last.slideId === entry.slideId &&
    last.mode === entry.mode &&
    Math.abs((last.timestamp || 0) - timestamp) <= UPSERT_WINDOW_MS
  ) {
    const updated = [...existing.slice(0, -1), { ...last, ...entry, timestamp }];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return;
  }

  const next = [...existing, { ...entry, timestamp }].slice(-MAX_ENTRIES);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const getTutorDialogueLog = (): TutorDialogueEntry[] => readLog();

export const clearTutorDialogueLog = () => {
  sessionStorage.removeItem(STORAGE_KEY);
};
