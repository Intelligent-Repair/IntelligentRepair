export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export function isValidStatusTransition(from: string | null | undefined, to: string) {
  if (!from) {
    // If there's no previous status, allow creating with 'open' only
    return to === "open";
  }
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
