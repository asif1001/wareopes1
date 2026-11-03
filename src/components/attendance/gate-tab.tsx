"use client";

import { useState } from "react";
import { Copy, ExternalLink, Loader2, MapPin, QrCode, RefreshCw, ScanLine, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Geofence } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";

type GateSite = Geofence & { hasGateScreen?: boolean };

/** Active sites whose gate screen this user may open: all for admins / editors, otherwise sites of the staff they supervise. */
export function useGateSites() {
  const { geofences, staff, me, manages } = useAttendance();
  const sites = (geofences as GateSite[]).filter((g) => g.active);
  if (!me) return [];
  if (me.isAdmin || me.canEdit) return sites;
  return sites.filter((g) => staff.some((s) => s.active && manages(s) && s.geofenceIds?.includes(g.id)));
}

/** Open / copy / renew the gate screen link of one site. Every link view is audited on the server. */
export function GateSiteActions({ siteId, compact }: { siteId: string; compact?: boolean }) {
  const { toast } = useToast();
  const { reload } = useAttendance();
  const [busy, setBusy] = useState<"open" | "copy" | "new" | null>(null);

  async function link(regenerate: boolean) {
    const res = await api<{ url: string }>("/gate-key", { method: "POST", body: { site: siteId, regenerate } });
    return res.url;
  }

  async function open() {
    // Open the tab now (before the request) so the browser does not block it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    setBusy("open");
    try {
      const url = await link(false);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      void reload();
    } catch (error) {
      tab?.close();
      toast({ variant: "destructive", title: "Could not open the gate screen", description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    try {
      const url = await link(false);
      await navigator.clipboard.writeText(url);
      toast({ title: "Gate screen link copied", description: "Paste it into the browser of the gate tablet or PC." });
      void reload();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not copy the link", description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function renew() {
    if (!window.confirm("Create a new link? The gate screen that uses the old link will stop working until you open the new one.")) return;
    setBusy("new");
    try {
      const url = await link(true);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast({ title: "New gate link created and copied", description: "The old link has stopped working." });
      void reload();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not create a new link", description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const spin = (k: typeof busy) => busy === k && <Loader2 className="mr-1 h-4 w-4 animate-spin" />;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" disabled={!!busy} onClick={() => void open()}>
        {spin("open") || <ExternalLink className="mr-1 h-4 w-4" />} {compact ? "Gate screen" : "Open gate screen"}
      </Button>
      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void copy()}>
        {spin("copy") || <Copy className="mr-1 h-4 w-4" />} Copy link
      </Button>
      {!compact && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void renew()}>
          {spin("new") || <RefreshCw className="mr-1 h-4 w-4" />} New link
        </Button>
      )}
    </div>
  );
}

export function GateTab() {
  const sites = useGateSites();
  const { staff } = useAttendance();

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5" /> Gate check-in screens
          </CardTitle>
          <CardDescription>
            Open a site&apos;s gate screen on a tablet or PC at the gate (plugged in and online) and press Full screen. Keep the link private —
            anyone with it can show that site&apos;s check-in code. If it leaks, create a new link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sites.length === 0 && <p className="text-sm text-muted-foreground">No active sites for your staff.</p>}
          {sites.map((g) => {
            const count = staff.filter((s) => s.active && s.geofenceIds?.includes(g.id)).length;
            return (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" /> {g.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{count} staff</span>
                    <span>· circle {g.radiusM} m</span>
                    <Badge variant={g.hasGateScreen ? "default" : "outline"}>{g.hasGateScreen ? "Link created" : "No link yet"}</Badge>
                  </div>
                </div>
                <GateSiteActions siteId={g.id} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How staff check in and out</CardTitle>
          <CardDescription>Any one of three ways. The first record of the day is IN, the last one is OUT.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">1. GPS in the app</div>
              <div className="text-muted-foreground">Check In / Check Out with GPS — only works inside the site circle.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">2. Scan the site QR</div>
              <div className="text-muted-foreground">Staff tap “Scan site QR” and scan the code on the gate screen. No GPS needed.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">3. Show My QR at the gate</div>
              <div className="text-muted-foreground">
                Staff open “My QR”; the gate screen reads it with a USB / Bluetooth 2D QR scanner or its camera (“Use camera”). Works without
                internet or GPS on the phone.
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Check-outs after the overtime start time (normally 30 minutes after the shift ends), and work on days off, are recorded as overtime
            — approved automatically; review them in the Overtime tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
