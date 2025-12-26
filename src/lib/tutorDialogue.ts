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
  const existing = readLog();
  const next = [...existing, entry].slice(-MAX_ENTRIES);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const getTutorDialogueLog = (): TutorDialogueEntry[] => readLog();

export const clearTutorDialogueLog = () => {
  sessionStorage.removeItem(STORAGE_KEY);
};
