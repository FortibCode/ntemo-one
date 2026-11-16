"use client";

import React, { useState } from "react";
import type { TrendPoint } from "@/lib/services/dashboardService";

/** Palette catégorielle validée (fond sombre #0f172a) : slot 1 bleu, slot 2 orange. */
const COLORS = { onTime: "#3987e5", late: "#d95926" };

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const GAP = 2; // espace de surface entre segments empilés

function dayLabel(date: string, short = true): string {
  const d = new Date(`${date}T00:00:00`);
  return short
    ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
    : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Graduations « rondes » pour l'axe Y. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4 / 5) * 5;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/** Barre aux coins supérieurs arrondis (4 px), ancrée sur la ligne de base. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export default function AttendanceTrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const yTicks = ticks(Math.max(...data.map((d) => d.present), 0));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const slot = PLOT_W / Math.max(data.length, 1);
  const barW = Math.min(36, slot * 0.55);
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        {/* Légende (toujours présente pour 2 séries) */}
        <div className="flex items-center gap-4 text-xs text-slate-300" aria-hidden={showTable}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLORS.onTime }} />À l&rsquo;heure
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLORS.late }} />En retard
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] text-slate-400 hover:text-white underline-offset-2 hover:underline"
        >
          {showTable ? "Voir le graphique" : "Voir le tableau"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-xs text-slate-300">
          <thead className="text-slate-400">
            <tr>
              <th className="text-left font-semibold py-1.5">Jour</th>
              <th className="text-right font-semibold py-1.5">Présents</th>
              <th className="text-right font-semibold py-1.5">À l&rsquo;heure</th>
              <th className="text-right font-semibold py-1.5">En retard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.map((d) => (
              <tr key={d.date}>
                <td className="py-1.5 capitalize">{dayLabel(d.date, false)}</td>
                <td className="py-1.5 text-right font-mono">{d.present}</td>
                <td className="py-1.5 text-right font-mono">{d.present - d.late}</td>
                <td className="py-1.5 text-right font-mono">{d.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Présences des ${data.length} derniers jours, à l'heure et en retard`}
            onMouseLeave={() => setHover(null)}
          >
            {/* Grille et axe Y, en retrait */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#64748b">
                  {t}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const x = cx - barW / 2;
              const onTime = d.present - d.late;
              const hOnTime = (onTime / yMax) * PLOT_H;
              const hLate = (d.late / yMax) * PLOT_H;
              const base = PAD.top + PLOT_H;
              const dim = hover !== null && hover !== i;
              return (
                <g key={d.date} opacity={dim ? 0.45 : 1}>
                  {onTime > 0 && (
                    <path
                      d={
                        d.late > 0
                          ? `M${x},${base} V${base - hOnTime} H${x + barW} V${base} Z`
                          : topRoundedRect(x, base - hOnTime, barW, hOnTime, 4)
                      }
                      fill={COLORS.onTime}
                    />
                  )}
                  {d.late > 0 && (
                    <path
                      d={topRoundedRect(
                        x,
                        base - hOnTime - hLate,
                        barW,
                        Math.max(0, hLate - (onTime > 0 ? GAP : 0)),
                        4,
                      )}
                      fill={COLORS.late}
                    />
                  )}
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
                    {dayLabel(d.date)}
                  </text>
                  {/* Zone de survol plus grande que la barre */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={PLOT_H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${dayLabel(d.date, false)} : ${d.present} présents dont ${d.late} en retard`}
                  />
                </g>
              );
            })}
          </svg>

          {hovered && hover !== null && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl"
              style={{ left: `${((PAD.left + slot * hover + slot / 2) / WIDTH) * 100}%`, top: 0 }}
            >
              <p className="font-semibold text-white capitalize mb-1">{dayLabel(hovered.date, false)}</p>
              <p className="text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.onTime }} />
                À l&rsquo;heure : <span className="font-mono text-white">{hovered.present - hovered.late}</span>
              </p>
              <p className="text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: COLORS.late }} />
                En retard : <span className="font-mono text-white">{hovered.late}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
