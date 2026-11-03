import type { Metadata } from "next";
import { GateScreen } from "./gate-screen";

export const metadata: Metadata = { title: "Gate check-in · WareOps", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ site?: string; key?: string }> };

/** Full-screen rotating check-in QR for a tablet or PC at the site gate (link from Attendance → Setup → Sites). */
export default async function GatePage({ searchParams }: Props) {
  const { site = "", key = "" } = await searchParams;
  return <GateScreen site={site} gateKey={key} />;
}
