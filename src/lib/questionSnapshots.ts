export type QuestionSnapshotEntry = {
  id: string;
  text: string;
  category?: string;
  type?: string;
  options?: string[];
};

const getSessionKey = (key: string) => `${key}:sessionId`;

export const updateQuestionSnapshot = (key: string, entries: QuestionSnapshotEntry[]) => {
  if (entries.length === 0) return;
  const sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) return;

  const sessionKey = getSessionKey(key);
  const storedSessionId = sessionStorage.getItem(sessionKey);
  if (storedSessionId && storedSessionId !== sessionId) {
    sessionStorage.removeItem(key);
  }
  sessionStorage.setItem(sessionKey, sessionId);

  const existing: QuestionSnapshotEntry[] = JSON.parse(sessionStorage.getItem(key) || '[]');
  const existingById = new Map(existing.map((entry) => [entry.id, entry]));
  const existingIds = new Set(existing.map((entry) => entry.id));

  entries.forEach((entry) => {
    existingById.set(entry.id, { ...existingById.get(entry.id), ...entry });
  });

  const merged = [
    ...existing.map((entry) => existingById.get(entry.id) || entry),
    ...entries.filter((entry) => !existingIds.has(entry.id)),
  ];

  sessionStorage.setItem(key, JSON.stringify(merged));
};
