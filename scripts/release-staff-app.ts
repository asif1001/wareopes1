/**
 * Announce a new staff app version (phones show "Update available"; nobody is forced).
 *   npx tsx scripts/release-staff-app.ts <version> <sha256>
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

(async () => {
  const [version, sha256] = process.argv.slice(2);
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "") || !/^[0-9a-f]{64}$/.test(sha256 ?? "")) throw new Error("Usage: release-staff-app.ts <x.y.z> <sha256>");
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { updateSettings } = await import("../src/lib/attendance/settings");
  const db = await getAdminDb();
  const actor = { userId: "release-script", role: "Admin", isAdmin: true };
  const rules = await updateSettings(db, actor, { latestAppVersion: version, apkSha256: sha256 }, new Date());
  console.log(`latest ${rules.latestAppVersion} · minimum ${rules.minAppVersion} · ${rules.apkUrl}`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
