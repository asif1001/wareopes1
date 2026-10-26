import type { Actor } from "./actor";
import { DEFAULT_RULES, rulesSchema } from "./config";
import { writeAudit } from "./audit";
import { badRequest } from "./errors";
import { COL, RULES_DOC, getRules, type Db } from "./store";

export async function getSettings(db: Db) {
  return { rules: await getRules(db), defaults: DEFAULT_RULES };
}

/** Partial update of the rules; unknown keys are rejected, the rest is validated. */
export async function updateSettings(db: Db, actor: Actor, body: unknown, now: Date) {
  const parsed = rulesSchema.partial().strict().safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw badRequest(issue ? `${issue.path.join(".") || "settings"}: ${issue.message}` : "Invalid settings");
  }
  const before = await getRules(db);
  const after = rulesSchema.parse({ ...before, ...parsed.data });
  if (after.otEscalateAfterHours <= after.otReminderAfterHours) {
    throw badRequest("Escalation must be later than the reminder");
  }
  await db.collection(COL.settings).doc(RULES_DOC).set(after);
  await writeAudit(db, { who: actor.userId, what: "SETTINGS_UPDATED", entity: COL.settings, entityId: RULES_DOC, before, after }, now);
  return after;
}
