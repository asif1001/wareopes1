"use client";

import { useMemo } from "react";
import { buildZoneModel, rackLabel, zoneLocations, type DesignZone } from "@/lib/warehouse/rack-design";

type Props = {
  zone: DesignZone;
  /** Occupied locators (upper case); racks are shaded by how full they are. */
  occupied?: Set<string>;
};

const VIEW_W = 900;
const VIEW_H = 480;

function heat(t: number) {
  const a = [0xd8, 0xea, 0xf8];
  const b = [0xe3, 0x9a, 0x4a];
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${a.map((v, i) => Math.round(v * (1 - k) + b[i] * k)).join(",")})`;
}

/** Top-down plan of one zone, as in the rack designer: aisles, pick faces and numbering direction. */
export function RackFloorPlan({ zone, occupied }: Props) {
  const view = useMemo(() => {
    const model = buildZoneModel(zone);
    const fill = new Map<number, { o: number; t: number }>();
    for (const loc of zoneLocations(zone, 0, model)) {
      const f = fill.get(loc.rack.index) ?? { o: 0, t: 0 };
      f.t += 1;
      if (occupied?.has(loc.locator)) f.o += 1;
      fill.set(loc.rack.index, f);
    }
    return { model, fill };
  }, [zone, occupied]);

  const { model, fill } = view;
  const B = model.bounds;
  const Wm = Math.max(1, B.x1 - B.x0);
  const Hm = Math.max(1, B.y1 - B.y0);
  const s = Math.min(800 / Wm, 360 / Hm);
  const ox = 60 + (800 - Wm * s) / 2 - B.x0 * s;
  const oy = 66 + (360 - Hm * s) / 2 - B.y0 * s;
  const X = (x: number) => x * s + ox;
  const Y = (y: number) => y * s + oy;
  const wpx = zone.rackW * s;
  const A = zone.aisle;

  const frontEdge = (r: (typeof model.racks)[number]): [[number, number], [number, number]] =>
    r.n[1] > 0
      ? [[r.x0, r.y1], [r.x1, r.y1]]
      : r.n[1] < 0
        ? [[r.x0, r.y0], [r.x1, r.y0]]
        : r.n[0] > 0
          ? [[r.x1, r.y0], [r.x1, r.y1]]
          : [[r.x0, r.y0], [r.x0, r.y1]];

  const arrows = zone.rows.map((_row, i) => {
    const list = model.racks.filter((r) => r.row === i);
    if (!list.length) return null;
    const a = list[0];
    const b = list[list.length - 1];
    const off = Math.min(A * 0.3, 0.9);
    const p = (r: typeof a) => [r.fx + r.n[0] * off, r.fy + r.n[1] * off];
    const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
    const u = [(b.cx - a.cx) / len, (b.cy - a.cy) / len];
    const h = zone.rackW * 0.35;
    const p1 = p(a);
    const p2 = p(b);
    const t = list.length > 1 ? [p1[0] - u[0] * (h + 0.9), p1[1] - u[1] * (h + 0.9)] : p1;
    return { i, multi: list.length > 1, x1: X(p1[0] - u[0] * h), y1: Y(p1[1] - u[1] * h), x2: X(p2[0] + u[0] * h), y2: Y(p2[1] + u[1] * h), tx: X(t[0]), ty: Y(t[1]) + 4 };
  });

  const yT = Y(B.y0) - 28;
  const xL = X(B.x0) - 28;
  const scaleBar = Wm > 40 ? 10 : 5;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" role="img" aria-label={`Floor plan of zone ${zone.zone}`}>
      <defs>
        <marker id="rack-plan-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="#2563c4" />
        </marker>
      </defs>
      <rect x={X(B.x0 - 0.6)} y={Y(B.y0 - 0.6)} width={(Wm + 1.2) * s} height={(Hm + 1.2) * s} fill="#f4f7fa" stroke="#9fb0c3" strokeWidth={1.2} strokeDasharray="8 5" />
      {model.aisles.map((a) => (
        <g key={a.key}>
          <rect x={X(a.x)} y={Y(a.y)} width={a.w * s} height={a.h * s} fill="#fbf6dc" stroke="#e0b100" strokeDasharray="6 4" />
          <text x={X(a.x + a.w / 2)} y={Y(a.y + a.h / 2) + 4} fontSize={11} fill="#8a6d00" textAnchor="middle">
            {a.label} · {A.toFixed(1)} m
          </text>
        </g>
      ))}
      {model.racks.map((r) => {
        const f = fill.get(r.index);
        const [e1, e2] = frontEdge(r);
        return (
          <g key={r.index}>
            <title>{`${r.id} · ${r.levels} levels × ${zone.bins} bins${f ? ` · ${f.o}/${f.t} occupied` : ""}`}</title>
            <rect x={X(r.x0)} y={Y(r.y0)} width={(r.x1 - r.x0) * s} height={(r.y1 - r.y0) * s} fill={heat(f && f.t ? f.o / f.t : 0)} stroke="#2b587e" />
            <line x1={X(e1[0])} y1={Y(e1[1])} x2={X(e2[0])} y2={Y(e2[1])} stroke="#f08a24" strokeWidth={3} />
            {wpx >= 15 && (
              <text x={X(r.cx)} y={Y(r.cy) + 3} fontSize={Math.min(11, wpx * 0.36)} fill="#173e67" textAnchor="middle">
                {rackLabel(zone, r.num)}
              </text>
            )}
          </g>
        );
      })}
      {arrows.map(
        (a) =>
          a && (
            <g key={a.i}>
              {a.multi && <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#2563c4" strokeWidth={1.6} markerEnd="url(#rack-plan-arrow)" />}
              <text x={a.tx} y={a.ty} fontSize={11} fontWeight="bold" fill="#2563c4" textAnchor="middle">
                R{a.i + 1}
              </text>
            </g>
          ),
      )}
      <g stroke="#64748b" fill="#51627a" fontSize={11} textAnchor="middle">
        <line x1={X(B.x0)} y1={yT} x2={X(B.x1)} y2={yT} />
        <line x1={X(B.x0)} y1={yT - 5} x2={X(B.x0)} y2={yT + 5} />
        <line x1={X(B.x1)} y1={yT - 5} x2={X(B.x1)} y2={yT + 5} />
        <text x={(X(B.x0) + X(B.x1)) / 2} y={yT - 6} stroke="none">
          {Wm.toFixed(1)} m
        </text>
        <line x1={xL} y1={Y(B.y0)} x2={xL} y2={Y(B.y1)} />
        <line x1={xL - 5} y1={Y(B.y0)} x2={xL + 5} y2={Y(B.y0)} />
        <line x1={xL - 5} y1={Y(B.y1)} x2={xL + 5} y2={Y(B.y1)} />
        <text transform={`translate(${xL - 7} ${(Y(B.y0) + Y(B.y1)) / 2}) rotate(-90)`} stroke="none">
          {Hm.toFixed(1)} m
        </text>
        <line x1={X(B.x0)} y1={Y(B.y1) + 26} x2={X(B.x0) + scaleBar * s} y2={Y(B.y1) + 26} strokeWidth={3} />
        <text x={X(B.x0) + (scaleBar * s) / 2} y={Y(B.y1) + 40} stroke="none">
          {scaleBar} m
        </text>
      </g>
      <text x={14} y={22} fontSize={13} fill="#5d708b">
        Zone {zone.zone} · top-down · orange edge = pick face · blue arrows = rack numbers increase
      </text>
    </svg>
  );
}
