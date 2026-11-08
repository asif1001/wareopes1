/**
 * Require a minimum staff app version (older phones show only the update screen).
 *   npx tsx scripts/set-min-staff-app.ts <version>
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

(async () => {
  const [version] = process.argv.slice(2);
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error("Usage: set-min-staff-app.ts <x.y.z>");
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { updateSettings } = await import("../src/lib/attendance/settings");
  const db = await getAdminDb();
  const actor = { userId: "release-script", role: "Admin", isAdmin: true };
  const rules = await updateSettings(db, actor, { minAppVersion: version }, new Date());
  console.log(`latest ${rules.latestAppVersion} · minimum ${rules.minAppVersion} · ${rules.apkUrl}`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
