"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StationPanel } from "./station-panel";

type Gate = { siteName: string; svg: string; expiresAt: string; serverTime: string };

const RETRY_MS = 10_000;
/** The server accepts a code for ±90 s, so a screen that lost its connection may keep showing it briefly. */
const STALE_AFTER_MS = 60_000;

export function GateScreen({ site, gateKey }: { site: string; gateKey: string }) {
  const [gate, setGate] = useState<Gate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(0);
  const offsetRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let next = RETRY_MS;
    try {
      const res = await fetch(`/api/attendance/gate?site=${encodeURIComponent(site)}&key=${encodeURIComponent(gateKey)}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        if (res.status >= 400 && res.status < 500) {
          setError(body?.error ?? "This gate screen link is not valid.");
          setGate(null);
          return;
        }
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      offsetRef.current = Date.parse(body.serverTime) - Date.now();
      setGate(body);
      setError(null);
      setOffline(false);
      next = Math.max(1000, Date.parse(body.expiresAt) - (Date.now() + offsetRef.current) + 300);
    } catch {
      setOffline(true);
    }
    timerRef.current = setTimeout(load, next);
  }, [site, gateKey]);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Keep the screen awake while the page is open.
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    const acquire = () => {
      if (document.visibilityState === "visible" && nav.wakeLock) {
        nav.wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
      }
    };
    const onVisible = () => {
      acquire();
      if (document.visibilityState === "visible") void load();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [load]);

  const serverNow = now + offsetRef.current;
  const msLeft = gate ? Date.parse(gate.expiresAt) - serverNow : 0;
  const stale = !!gate && msLeft < -STALE_AFTER_MS;
  const clock = new Date(serverNow);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const qrSize = "w-[min(52vh,40vw)] max-lg:w-[min(60vh,80vw)]";

  return (
    <main className="flex min-h-screen flex-col items-center justify-between gap-4 bg-[#0B3A6F] px-6 py-5 text-white select-none">
      <header className="flex w-full max-w-6xl items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-white/60">EKK Attendance</div>
          <div className="text-2xl font-semibold sm:text-3xl">{gate?.siteName ?? (error ? "Gate screen" : "Loading…")}</div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold tabular-nums sm:text-5xl">
            {now ? clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "\u00a0"}
          </div>
          <div className="text-sm text-white/70">{now ? clock.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : "\u00a0"}</div>
        </div>
      </header>

      {error ? (
        <section className="flex flex-1 items-center justify-center">
          <div className="max-w-lg rounded-2xl bg-white/10 p-8 text-center text-lg">{error}</div>
        </section>
      ) : (
        <section className="grid w-full max-w-6xl flex-1 items-center gap-8 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-4">
            <div className="text-xl font-semibold sm:text-2xl">1 · Scan this with the app</div>
            {gate && !stale ? (
              <>
                <div
                  className={`aspect-square ${qrSize} rounded-3xl bg-white p-4 shadow-2xl [&>svg]:h-full [&>svg]:w-full`}
                  aria-label="Check-in QR code"
                  dangerouslySetInnerHTML={{ __html: gate.svg }}
                />
                <div className={`h-2 ${qrSize} overflow-hidden rounded-full bg-white/15`}>
                  <div
                    className="h-full rounded-full bg-[#1764E8] transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(100, (msLeft / 30_000) * 100))}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="max-w-lg rounded-2xl bg-white/10 p-8 text-center text-lg">
                {stale ? "No connection — the code cannot be refreshed. Check this screen's internet." : "Loading the check-in code…"}
              </div>
            )}
            <div className="max-w-md text-center text-base text-white/75">
              Open EKK Attendance and tap <b>Scan site QR</b>. The code changes every 30 seconds — photos of it will not work later.
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="text-xl font-semibold sm:text-2xl">2 · Or show your QR</div>
            <StationPanel site={site} gateKey={gateKey} />
          </div>
        </section>
      )}

      <footer className="flex w-full max-w-6xl flex-col items-center gap-2 text-center">
        {offline && !error && <div className="rounded-full bg-amber-500/90 px-4 py-1 text-sm font-medium text-black">Connection lost — reconnecting…</div>}
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            fullscreen();
          }}
          className="rounded-full border border-white/30 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          Full screen
        </button>
      </footer>
    </main>
  );
}