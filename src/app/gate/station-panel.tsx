"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Result = {
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED" | "QUEUED";
  type?: "IN" | "OUT";
  at?: string;
  staff?: { name: string; staffCode: string; company: string };
  message: string;
};
type QueuedScan = { code: string; scannedAt: string };

const STAFF_CODE = /EKKB1\.[A-Za-z0-9_-]{4,64}\.\d{6,12}\.[A-Za-z0-9_-]{22}/;
const RESULT_MS = 6000;
const RETRY_MS = 15_000;
/** The same code read again by the camera within this time is ignored. */
const SAME_CODE_MS = 8000;

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1200 : 300;
    osc.type = ok ? "sine" : "square";
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.45));
    osc.onended = () => void ctx.close();
  } catch {
    // no sound available
  }
}

/**
 * Reads the staff member's own QR ("My QR" in the app) with a USB / Bluetooth scanner
 * (it types the code and presses Enter) or with this device's camera, and records IN / OUT.
 * Scans made while offline are kept in this browser and sent when the connection is back.
 */
export function StationPanel({ site, gateKey }: { site: string; gateKey: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [queued, setQueued] = useState(0);
  const [camera, setCamera] = useState<"off" | "user" | "environment">("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recent = useRef(new Map<string, number>());
  const queueKey = `ekk.station.${site}`;

  const readQueue = useCallback((): QueuedScan[] => {
    try {
      return JSON.parse(localStorage.getItem(queueKey) ?? "[]") as QueuedScan[];
    } catch {
      return [];
    }
  }, [queueKey]);
  const writeQueue = useCallback(
    (items: QueuedScan[]) => {
      localStorage.setItem(queueKey, JSON.stringify(items));
      setQueued(items.length);
    },
    [queueKey],
  );

  const show = useCallback((r: Result) => {
    setResult(r);
    beep(r.status === "ACCEPTED" || r.status === "QUEUED");
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setResult(null), RESULT_MS);
  }, []);

  const post = useCallback(
    async (scans: QueuedScan[]) => {
      const res = await fetch("/api/attendance/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ site, key: gateKey, sentAt: new Date().toISOString(), scans }),
      });
      const body = await res.json().catch(() => null);
      if (res.status >= 500 || !body) throw new Error("offline");
      if (!body.success) return scans.map(() => ({ status: "REJECTED" as const, message: body.error ?? "Not recorded." }));
      return body.results as Result[];
    },
    [site, gateKey],
  );

  const submit = useCallback(
    async (raw: string) => {
      const code = raw.match(STAFF_CODE)?.[0];
      if (!code) {
        show({ status: "REJECTED", message: "This is not an EKK staff QR code. Open My QR in the app." });
        return;
      }
      const seen = recent.current.get(code);
      if (seen && Date.now() - seen < SAME_CODE_MS) return;
      recent.current.set(code, Date.now());
      const scan = { code, scannedAt: new Date().toISOString() };
      try {
        const [r] = await post([scan]);
        show(r);
      } catch {
        writeQueue([...readQueue(), scan]);
        show({ status: "QUEUED", message: "No connection. The scan is saved and will be sent automatically." });
      }
    },
    [post, readQueue, show, writeQueue],
  );

  // Send scans that were saved while offline.
  useEffect(() => {
    setQueued(readQueue().length);
    const timer = setInterval(async () => {
      const items = readQueue();
      if (!items.length) return;
      try {
        await post(items.slice(0, 50));
        writeQueue(readQueue().slice(Math.min(50, items.length)));
      } catch {
        // still offline
      }
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [post, readQueue, writeQueue]);

  // USB / Bluetooth scanners type the code and press Enter.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const now = Date.now();
      if (now - last > 1000) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length > 8) void submit(buffer);
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  // Camera scanning.
  useEffect(() => {
    if (camera === "off") return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    setCameraError(null);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camera } }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
        timer = setInterval(() => {
          const v = video.current;
          if (!v || !ctx || v.readyState < 2 || !v.videoWidth) return;
          const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
          if (found?.data && STAFF_CODE.test(found.data)) void submit(found.data);
        }, 300);
      } catch {
        setCameraError("Camera not available. Allow camera access for this page, or use a QR scanner.");
        setCamera("off");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, submit]);

  const tone =
    result?.status === "ACCEPTED"
      ? "bg-emerald-500 text-white"
      : result?.status === "REJECTED"
        ? "bg-red-600 text-white"
        : result
          ? "bg-amber-400 text-black"
          : "bg-white/10 text-white";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className={`flex min-h-[min(46vh,420px)] w-full flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center shadow-2xl transition-colors ${tone}`}>
        {result ? (
          <>
            {result.staff && <div className="text-3xl font-bold sm:text-4xl">{result.staff.name}</div>}
            {result.staff && (
              <div className="text-lg opacity-90">
                ID {result.staff.staffCode}
                {result.staff.company ? ` · ${result.staff.company}` : ""}
              </div>
            )}
            {result.status === "ACCEPTED" && result.type && (
              <div className="mt-2 text-5xl font-extrabold tracking-wide sm:text-6xl">{result.type === "IN" ? "IN" : "OUT"}</div>
            )}
            <div className="text-xl font-medium sm:text-2xl">{result.message}</div>
          </>
        ) : camera !== "off" ? null : (
          <>
            <div className="text-2xl font-semibold sm:text-3xl">Show My QR here</div>
            <div className="max-w-md text-base text-white/75 sm:text-lg">
              No internet or GPS on your phone? Open <b>My QR</b> in the app and hold it in front of the scanner.
            </div>
          </>
        )}
        {camera !== "off" && (
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            className={result ? "hidden" : "aspect-square w-full max-w-sm rounded-2xl bg-black object-cover"}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Scanner ready</span>
        {queued > 0 && <span className="rounded-full bg-amber-400 px-3 py-1 font-medium text-black">{queued} scan(s) waiting to send</span>}
        <button
          type="button"
          onClick={() => setCamera(camera === "off" ? "user" : "off")}
          className="rounded-full border border-white/30 px-3 py-1 text-white/80 hover:bg-white/10"
        >
          {camera === "off" ? "Use camera" : "Stop camera"}
        </button>
        {camera !== "off" && (
          <button
            type="button"
            onClick={() => setCamera(camera === "user" ? "environment" : "user")}
            className="rounded-full border border-white/30 px-3 py-1 text-white/80 hover:bg-white/10"
          >
            Switch camera
          </button>
        )}
      </div>
      {cameraError && <div className="text-sm text-amber-300">{cameraError}</div>}
    </div>
  );
}
