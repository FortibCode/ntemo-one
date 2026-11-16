"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/layout/AdminSidebar";
import AttendanceTrendChart from "@/components/dashboard/AttendanceTrendChart";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { dashboardService, type DashboardKpis } from "@/lib/services/dashboardService";

const EVENT_LABELS: Record<string, { label: string; cls: string }> = {
  IN: { label: "Arrivée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  OUT: { label: "Départ", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  BREAK_IN: { label: "Pause", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  BREAK_OUT: { label: "Reprise", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

function Tile({
  label,
  icon,
  value,
  valueClass = "text-white",
  children,
}: {
  label: string;
  icon: string;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex justify-between items-center text-slate-400 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
      </div>
      <div className={`text-3xl font-extrabold ${valueClass}`}>{value}</div>
      {children && <div className="mt-2 text-xs text-slate-400">{children}</div>}
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "dashboard.view");

  const [currentDate, setCurrentDate] = useState("");
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Date affichée côté client uniquement (évite un écart avec le pré-rendu serveur)
  useEffect(() => {
    const t = setTimeout(() =>
      setCurrentDate(
        new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      ),
    );
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    dashboardService
      .kpis()
      .then((data) => {
        if (cancelled) return;
        setKpis(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setError("Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.");
        } else if (err instanceof TypeError) {
          setError("Serveur injoignable. Vérifiez que l'API est démarrée.");
        } else {
          setError(err instanceof Error ? err.message : "Impossible de charger les indicateurs.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, refreshKey]);

  // Actualisation automatique toutes les 60 s (flux de pointages)
  useEffect(() => {
    if (!canView) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(t);
  }, [canView]);

  const pendingTotal = kpis
    ? kpis.leaves.pending_approval_count + kpis.approvals.pending_corrections + kpis.approvals.pending_timesheets
    : 0;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">📊 Tableau de bord</h1>
            <p className="text-xs text-slate-400 mt-1">
              <span className="capitalize">{currentDate || "…"}</span> &bull; Bienvenue,{" "}
              <span className="text-blue-400 font-semibold">{user?.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/attendance"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
            >
              ⏱️ Borne de pointage
            </Link>
            <Link
              href="/documents"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold"
            >
              📄 Générer un document
            </Link>
          </div>
        </div>

        {!canView ? (
          <div className="mt-8 max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white">Votre espace</h2>
            <p className="text-sm text-slate-400 mt-1">
              Les indicateurs consolidés sont réservés à la Direction et aux RH. Accédez à vos services :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { href: "/leaves", icon: "🏖️", label: "Mes congés" },
                { href: "/timesheets", icon: "🕒", label: "Feuilles de temps" },
                { href: "/documents", icon: "📄", label: "Mes documents" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-xl text-sm text-white"
                >
                  <span className="text-xl block mb-1">{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="mt-8 p-10 text-center text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
            Chargement des indicateurs…
          </div>
        ) : error || !kpis ? (
          <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-sm text-rose-300 flex justify-between gap-4">
            <span>⚠️ {error}</span>
            <button
              onClick={() => {
                setLoading(true);
                setRefreshKey((k) => k + 1);
              }}
              className="underline"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {/* Alertes contrats (§3.4) */}
            {kpis.contract_alerts.length > 0 && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl" role="status">
                <h2 className="text-sm font-bold text-amber-300">
                  ⚠️ {kpis.contract_alerts.length} échéance{kpis.contract_alerts.length > 1 ? "s" : ""} de contrat
                  dans les 30 prochains jours
                </h2>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {kpis.contract_alerts.slice(0, 5).map((a, i) => (
                    <li key={`${a.employee.id}-${a.kind}-${i}`}>
                      <span className="font-semibold text-white">{a.employee.full_name}</span>{" "}
                      <span className="font-mono text-slate-500">{a.employee.matricule}</span> —{" "}
                      {a.kind === "PROBATION_END" ? "fin de période d'essai" : `échéance du ${a.contract_type}`} le{" "}
                      {new Date(`${a.date}T00:00:00`).toLocaleDateString("fr-FR")}{" "}
                      <span className="text-amber-300">
                        ({a.days_left === 0 ? "aujourd'hui" : `dans ${a.days_left} j`})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pièces RH expirées ou proches de l'expiration (§3.4) */}
            {kpis.document_alerts.length > 0 && (
              <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl" role="status">
                <h2 className="text-sm font-bold text-rose-300">
                  🪪 {kpis.document_alerts.length} pièce{kpis.document_alerts.length > 1 ? "s" : ""} d&rsquo;identité ou
                  justificatif{kpis.document_alerts.length > 1 ? "s" : ""} à renouveler
                </h2>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {kpis.document_alerts.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <span className="font-semibold text-white">{d.employee.full_name}</span>{" "}
                      <span className="font-mono text-slate-500">{d.employee.matricule}</span> — {d.title}{" "}
                      <span className="text-rose-300">
                        {d.days_left < 0
                          ? `expirée depuis ${Math.abs(d.days_left)} j`
                          : d.days_left === 0
                            ? "expire aujourd'hui"
                            : `expire dans ${d.days_left} j`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Indicateurs (§3.5) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-6">
              <Tile
                label="Taux de présence"
                icon="⏱️"
                value={`${kpis.attendance.attendance_rate_percentage.toLocaleString("fr-FR")} %`}
              >
                {kpis.attendance.present_today} présent{kpis.attendance.present_today > 1 ? "s" : ""} sur{" "}
                {Math.max(0, kpis.workforce.active_employees - kpis.workforce.on_leave_today)} attendus
                {!kpis.is_working_day && <span className="block text-slate-500">Jour non ouvré</span>}
                <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, kpis.attendance.attendance_rate_percentage)}%` }}
                  />
                </div>
              </Tile>

              <Tile label="Retards & absences" icon="🚦" value={kpis.attendance.late_today}>
                retard{kpis.attendance.late_today > 1 ? "s" : ""} aujourd&rsquo;hui &bull;{" "}
                <span className="text-white font-semibold">{kpis.attendance.absent_today}</span> absent
                {kpis.attendance.absent_today > 1 ? "s" : ""} &bull;{" "}
                <span className="text-white font-semibold">{kpis.workforce.on_leave_today}</span> en congé
              </Tile>

              <Tile label="À valider" icon="✅" value={pendingTotal}>
                <Link href="/leaves" className="hover:text-white">
                  {kpis.leaves.pending_manager_count} congé(s) N+1 &bull; {kpis.leaves.pending_hr_count} RH
                </Link>
                <Link href="/attendance" className="block hover:text-white">
                  {kpis.approvals.pending_corrections} régularisation(s) de pointage
                </Link>
                <Link href="/timesheets" className="block hover:text-white">
                  {kpis.approvals.pending_timesheets} feuille(s) de temps
                </Link>
              </Tile>

              <Tile label="Documents ce mois" icon="📄" value={kpis.documents.generated_this_month}>
                {kpis.documents.active_badges} badge(s) actif(s) &bull;{" "}
                {kpis.projects.approved_hours_this_month.toLocaleString("fr-FR")} h approuvées sur{" "}
                {kpis.projects.active_projects_count} projet(s)
                {kpis.projects.overdue_tasks_count > 0 && (
                  <Link href="/projects" className="block text-rose-300 hover:text-rose-200 font-semibold">
                    ⚠ {kpis.projects.overdue_tasks_count} tâche(s) en retard
                  </Link>
                )}
              </Tile>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
              {/* Tendance */}
              <section className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-base font-bold text-white">Présences des 7 derniers jours</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Collaborateurs ayant pointé, répartis entre arrivées à l&rsquo;heure et en retard
                </p>
                <AttendanceTrendChart data={kpis.attendance.trend} />
              </section>

              {/* Flux de pointages */}
              <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white">Pointages du jour</h2>
                  <span className="text-[11px] text-slate-500">Actualisé chaque minute</span>
                </div>
                {kpis.attendance.recent_events.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun pointage enregistré aujourd&rsquo;hui.</p>
                ) : (
                  <ul className="space-y-3">
                    {kpis.attendance.recent_events.map((e) => {
                      const meta = EVENT_LABELS[e.type] ?? { label: e.type, cls: "bg-slate-800 text-slate-300 border-slate-700" };
                      return (
                        <li key={e.id} className="flex items-center gap-3">
                          <span className="w-9 h-9 flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {initials(e.employee.full_name)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{e.employee.full_name ?? "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {e.employee.department ?? "—"}
                              {e.source === "MANUAL_OVERRIDE" && " • régularisation"}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-slate-300">{e.time}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
