import type { Transaction } from "firebase-admin/firestore";
import { COL, type Db } from "./store";
import type { AuditEntry } from "./types";

export type AuditInput = Omit<AuditEntry, "id" | "when"> & { when?: string };

function entry(input: AuditInput, now: Date) {
  return {
    who: input.who,
    what: input.what,
    entity: input.entity,
    entityId: input.entityId,
    when: input.when ?? now.toISOString(),
    before: input.before ?? null,
    after: input.after ?? null,
  };
}

/** Append-only audit trail. */
export async function writeAudit(db: Db, input: AuditInput, now = new Date()) {
  await db.collection(COL.audit).add(entry(input, now));
}

export function writeAuditInTx(db: Db, tx: Transaction, input: AuditInput, now = new Date()) {
  tx.set(db.collection(COL.audit).doc(), entry(input, now));
}
