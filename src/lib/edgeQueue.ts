import { supabase } from "@/integrations/supabase/client";

type EdgeQueueItem = {
  id: string;
  fn: string;
  body: Record<string, unknown>;
  attempts: number;
  createdAt: number;
  nextAttemptAt?: number;
  dedupeKey?: string;
};

type EnqueueOptions = {
  dedupeKey?: string;
};

const STORAGE_KEY = "edgeFunctionQueueV1";
const MAX_QUEUE_ITEMS = 200;
const MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 60000;
const BASE_BACKOFF_MS = 5000;

let isProcessing = false;

const canUseStorage = () =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readQueue = (): EdgeQueueItem[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  } catch {
    return [];
  }
};

const writeQueue = (items: EdgeQueueItem[]) => {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to persist edge queue:", error);
  }
};

export const enqueueEdgeCall = (fn: string, body: Record<string, unknown>, options: EnqueueOptions = {}) => {
  if (!canUseStorage()) return;
  try {
    JSON.stringify(body);
  } catch {
    return;
  }

  const now = Date.now();
  const queue = readQueue().filter((item) => now - item.createdAt < MAX_ITEM_AGE_MS);
  const { dedupeKey } = options;
  const newItem: EdgeQueueItem = {
    id: makeId(),
    fn,
    body,
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
    dedupeKey,
  };

  if (dedupeKey) {
    const existingIndex = queue.findIndex((item) => item.dedupeKey === dedupeKey);
    if (existingIndex >= 0) {
      queue[existingIndex] = { ...queue[existingIndex], ...newItem };
    } else {
      queue.push(newItem);
    }
  } else {
    queue.push(newItem);
  }

  if (queue.length > MAX_QUEUE_ITEMS) {
    queue.sort((a, b) => a.createdAt - b.createdAt);
    queue.splice(0, queue.length - MAX_QUEUE_ITEMS);
  }

  writeQueue(queue);
};

export const processEdgeQueue = async () => {
  if (isProcessing || !canUseStorage()) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  isProcessing = true;
  const now = Date.now();
  const remaining: EdgeQueueItem[] = [];

  try {
    for (const item of queue) {
      if (now - item.createdAt > MAX_ITEM_AGE_MS) {
        continue;
      }
      if (item.nextAttemptAt && item.nextAttemptAt > now) {
        remaining.push(item);
        continue;
      }
      try {
        const { data, error } = await supabase.functions.invoke(item.fn, { body: item.body });
        if (error) {
          throw error;
        }
        if (data?.error) {
          throw new Error(data.error);
        }
      } catch (error) {
        const attempts = item.attempts + 1;
        const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * attempts);
        remaining.push({
          ...item,
          attempts,
          nextAttemptAt: Date.now() + backoff,
        });
      }
    }
  } finally {
    writeQueue(remaining);
    isProcessing = false;
  }
};
