"use client";

import React, { useMemo } from "react";
import type { CalendarLeave } from "@/lib/services/leaveService";

/** Bleu validé (slot 1, fond sombre). « En attente » = même teinte hachurée (encodage secondaire, pas la couleur seule). */
const APPROVED = "#3987e5";

const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

interface Props {
  month: string; // AAAA-MM
  leaves: CalendarLeave[];
  today: string; // AAAA-MM-JJ
}

/**
 * Planning d'équipe : une ligne par collaborateur, une colonne par jour du mois.
 */
export default function LeaveCalendar({ month, leaves, today }: Props) {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, monthIndex - 1, i + 1);
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, iso, weekday: d.getDay() };
  });

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null; leaves: CalendarLeave[] }>();
    for (const l of leaves) {
      const key = l.employee.id;
      const row = map.get(key) ?? { name: l.employee.full_name, department: l.employee.department, leaves: [] };
      row.leaves.push(l);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [leaves]);

  const cellFor = (rowLeaves: CalendarLeave[], iso: string) =>
    rowLeaves.find((l) => l.start_date <= iso && l.end_date >= iso) ?? null;

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">Aucune absence prévue ce mois-ci.</p>;
  }

  return (
    <div>
      {/* Légende : identité portée aussi par le motif */}
      <div className="flex items-center gap-5 text-xs text-slate-300 mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm" style={{ background: APPROVED }} />
          Approuvé
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-4 h-3 rounded-sm border"
            style={{
              borderColor: APPROVED,
              background: `repeating-linear-gradient(45deg, ${APPROVED}66 0 3px, transparent 3px 6px)`,
            }}
          />
          En attente de validation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm bg-slate-800" />
          Week-end
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-[11px]" aria-label={`Absences du mois ${month}`}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-left font-semibold text-slate-400 pr-3 py-1 min-w-[170px]">
                Collaborateur
              </th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  className={`w-7 min-w-7 text-center font-normal py-1 ${d.iso === today ? "text-sky-300 font-bold" : "text-slate-500"}`}
                  scope="col"
                >
                  <div>{WEEKDAY_INITIALS[d.weekday]}</div>
                  <div>{d.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row" className="sticky left-0 z-10 bg-slate-900 text-left font-normal pr-3 py-1 align-middle">
                  <div className="text-white text-xs truncate max-w-[170px]">{row.name}</div>
                  {row.department && <div className="text-slate-500 truncate max-w-[170px]">{row.department}</div>}
                </th>
                {days.map((d) => {
                  const leave = cellFor(row.leaves, d.iso);
                  const weekend = d.weekday === 0 || d.weekday === 6;
                  const pending = leave && leave.status !== "APPROVED";
                  return (
                    <td key={d.iso} className="p-[1px]">
                      <div
                        title={
                          leave
                            ? `${row.name} — ${leave.leave_type ?? "Congé"} du ${new Date(leave.start_date + "T00:00:00").toLocaleDateString("fr-FR")} au ${new Date(leave.end_date + "T00:00:00").toLocaleDateString("fr-FR")}${pending ? " (en attente)" : ""}`
                            : undefined
                        }
                        className={`h-7 rounded-sm ${!leave ? (weekend ? "bg-slate-800" : "bg-slate-950") : ""} ${d.iso === today ? "ring-1 ring-sky-400/60" : ""}`}
                        style={
                          leave
                            ? pending
                              ? {
                                  border: `1px solid ${APPROVED}`,
                                  background: `repeating-linear-gradient(45deg, ${APPROVED}66 0 3px, transparent 3px 6px)`,
                                }
                              : { background: APPROVED }
                            : undefined
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
