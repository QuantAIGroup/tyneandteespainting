import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes a human-readable entry to the append-only audit log, recording WHO
 * did WHAT. (The database also logs every row change automatically; this adds
 * the person and the intent.) A failed audit write is logged but never hides
 * the result of the action from the user.
 */
export async function audit(entry: {
  actorUserId: string | null;
  actorKind: "admin" | "painter" | "system";
  action: string;
  entityType: string;
  entityId?: string | null;
  painterBusinessId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { error } = await db.from("audit_events").insert({
    actor_user_id: entry.actorUserId,
    actor_kind: entry.actorKind,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    painter_business_id: entry.painterBusinessId ?? null,
    details: entry.details ?? {},
  });
  if (error) console.error("[audit] write failed", entry.action, error.message);
}

/** Short unique reference, e.g. TT-J-261207-K7QD */
export function makeReference(prefix: string, now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `TT-${prefix}-${d}-${code}`;
}
