import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "tutorDialogueTableStatus";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

type StoredStatus = {
  status: "available" | "missing";
  checkedAt: number;
};

const readStoredStatus = (): StoredStatus | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStatus;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.status !== "available" && parsed.status !== "missing") return null;
    if (typeof parsed.checkedAt !== "number") return null;
    if (Date.now() - parsed.checkedAt > STORAGE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredStatus = (status: StoredStatus["status"]) => {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredStatus = { status, checkedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
};

const isMissingTableError = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  if (code === "42p01") return true;
  if (message.includes("relation") && message.includes("does not exist")) return true;
  if (message.includes("not found")) return true;
  return false;
};

let cachedStatus: StoredStatus["status"] | null = null;
let pendingCheck: Promise<boolean> | null = null;

export const canUseTutorDialogueTable = async (): Promise<boolean> => {
  if (cachedStatus) return cachedStatus === "available";
  const stored = readStoredStatus();
  if (stored) {
    cachedStatus = stored.status;
    return cachedStatus === "available";
  }
  if (pendingCheck) return pendingCheck;

  pendingCheck = (supabase
    .from("tutor_dialogue_turns" as any)
    .select("id", { head: true, count: "exact" })
    .limit(1) as unknown as Promise<{ error?: unknown }>)
    .then(({ error }) => {
      if (error && isMissingTableError(error)) {
        cachedStatus = "missing";
        writeStoredStatus("missing");
        return false;
      }
      if (error) {
        cachedStatus = "missing";
        writeStoredStatus("missing");
        return false;
      }
      cachedStatus = "available";
      writeStoredStatus("available");
      return true;
    })
    .catch(() => {
      cachedStatus = "missing";
      writeStoredStatus("missing");
      return false;
    })
    .finally(() => {
      pendingCheck = null;
    });

  return pendingCheck;
};

export const clearTutorDialogueTableCache = () => {
  cachedStatus = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};
