/**
 * Print the latest crash reports sent by the staff app.
 *   npx tsx scripts/attendance-crashes.ts [count]
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

(async () => {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { COL } = await import("../src/lib/attendance/store");
  const db = await getAdminDb();
  const count = Number(process.argv[2] ?? 5);
  const snap = await db.collection(COL.crashReports).orderBy("receivedAt", "desc").limit(count).get();
  if (snap.empty) console.log("No crash reports yet.");
  for (const doc of snap.docs) {
    const r = doc.data();
    console.log(`\n=== ${r.receivedAt} · ${r.kind} · app ${r.appVersion} · ${r.device} · ${r.os}`);
    console.log(String(r.details).slice(0, 6000));
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
