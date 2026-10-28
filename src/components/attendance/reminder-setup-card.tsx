"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "./api";
import { fmtDateTime } from "./format";

type Setup = {
  checkinUrl: string;
  apkUrl: string;
  latestAppVersion: string;
  cron: { url: string; method: string; headerName: string; configured: boolean; key: string | null; everyMinutes: number };
  pushConfigured: boolean;
  lastRun: { lastRunAt: string; sent?: number; skipped?: string; manual?: boolean } | null;
};

function CopyRow({ label, value, secret, onReveal, revealed }: { label: string; value: string; secret?: boolean; revealed?: boolean; onReveal?: () => void }) {
  const { toast } = useToast();
  const shown = secret && !revealed ? "•".repeat(24) : value;
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{shown || "—"}</code>
        {secret && onReveal && (
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onReveal} title={revealed ? "Hide" : "Show"}>
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={!value || (secret && !revealed)}
          title="Copy"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => toast({ title: `${label} copied` }));
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Admin only: links for staff and the cron-job.org settings for iPhone reminders. */
export function ReminderSetupCard() {
  const { toast } = useToast();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (reveal = false) => {
    try {
      const res = await api<Setup>(`/reminder-setup${reveal ? "?reveal=1" : ""}`);
      setSetup(res);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      await load(false);
    } else {
      await load(true);
      setRevealed(true);
    }
  }

  async function testNow() {
    setTesting(true);
    try {
      const res = await api<{ result: { sent: number; skipped?: string } }>("/reminder-setup", { method: "POST", body: {} });
      toast({ title: "Reminder check done", description: res.result.skipped ?? `${res.result.sent} reminder(s) sent now.` });
      await load(revealed);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not run reminders", description: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  }

  if (error) return null;
  const last = setup?.lastRun;
  const minutesAgo = last ? Math.round((Date.now() - Date.parse(last.lastRunAt)) / 60000) : null;
  const healthy = minutesAgo !== null && minutesAgo <= 15 && !last?.manual;

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">iPhone check-in, app download & reminders</CardTitle>
        <CardDescription>Links to give staff, and the settings for the free 5-minute timer (cron-job.org) that sends iPhone reminders. Admins only.</CardDescription>
      </CardHeader>
      <CardContent>
        {!setup ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Links for staff</h4>
              <CopyRow label="iPhone web app (open in Safari → Share → Add to Home Screen)" value={setup.checkinUrl} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={setup.checkinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" /> Open iPhone page
                  </a>
                </Button>
              </div>
              <CopyRow label={`Android app ${setup.latestAppVersion} (APK download)`} value={setup.apkUrl} />
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                <li>Staff → edit → tick <b>Allow iPhone check-in</b> for each iPhone user.</li>
                <li>On the iPhone: open the link in Safari → Share → <b>Add to Home Screen</b>.</li>
                <li>Open WareOps from the icon, sign in with CPR + password, then More → App Permissions → <b>Turn reminders on</b>.</li>
              </ol>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">cron-job.org (iPhone reminders)</h4>
                {!setup.cron.configured || !setup.pushConfigured ? (
                  <Badge variant="destructive">Keys missing on the server</Badge>
                ) : healthy ? (
                  <Badge>Working · last run {minutesAgo} min ago</Badge>
                ) : last ? (
                  <Badge variant="destructive">Last run {fmtDateTime(last.lastRunAt)}{last.manual ? " (test)" : ""}</Badge>
                ) : (
                  <Badge variant="secondary">Not called yet</Badge>
                )}
              </div>
              <CopyRow label="URL" value={setup.cron.url} />
              <div className="grid grid-cols-2 gap-3">
                <CopyRow label="Request method" value={setup.cron.method} />
                <CopyRow label="Schedule" value={`Every ${setup.cron.everyMinutes} minutes`} />
              </div>
              <CopyRow label="Header name" value={setup.cron.headerName} />
              <CopyRow label="Header value (key)" value={setup.cron.key ?? ""} secret revealed={revealed} onReveal={() => void toggleReveal()} />
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                <li>
                  Sign up free at{" "}
                  <a className="underline" href="https://cron-job.org" target="_blank" rel="noreferrer">
                    cron-job.org
                  </a>{" "}
                  → <b>Create cronjob</b>.
                </li>
                <li>Paste the URL, choose every 5 minutes.</li>
                <li>
                  Advanced → Headers → add <b>{setup.cron.headerName}</b> with the key above (press the eye to show it).
                </li>
                <li>Save. Within 5 minutes the badge here turns to “Working”.</li>
              </ol>
              <p className="text-xs text-muted-foreground">The key can only send reminders. Viewing it is recorded in the audit log.</p>
              <Button size="sm" variant="outline" onClick={() => void testNow()} disabled={testing}>
                {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                Send due reminders now (test)
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
