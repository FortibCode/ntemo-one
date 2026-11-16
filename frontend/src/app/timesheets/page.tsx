"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  timesheetService,
  type Project,
  type TimeEntry,
  type TimeEntryStatus,
} from "@/lib/services/timesheetService";

type Feedback = { kind: "success" | "error"; text: string };

const STATUS: Record<TimeEntryStatus, { label: string; cls: string }> = {
  SUBMITTED: { label: "En attente", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  APPROVED: { label: "Validée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  REJECTED: { label: "Rejetée", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.errors) return Object.values(err.errors).flat().join(" ");
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

const hours = (h: string | number) => Number(h).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const formatDate = (d: string) => new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("fr-FR");

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi de la semaine courante (AAAA-MM-JJ, heure locale). */
function mondayIso(): string {
  const now = new Date();
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const canApprove = hasPermission(user, "timesheets.approve");

  const [tab, setTab] = useState<"mine" | "review">("mine");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /* ── Mes heures ─────────────────────────────────────────── */
  const [projects, setProjects] = useState<Project[]>([]);
  const [mine, setMine] = useState<TimeEntry[]>([]);
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineKey, setMineKey] = useState(0);

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [date, setDate] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([timesheetService.projects(), timesheetService.myEntries()])
      .then(([projs, entries]) => {
        if (cancelled) return;
        setProjects(projs);
        setMine(entries.data ?? []);
        setMineError(null);
        const now = todayIso();
        setToday(now);
        setDate((d) => d || now);
        setWeekStart(mondayIso());
      })
      .catch((err: unknown) => {
        if (!cancelled) setMineError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setMineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mineKey]);

  const activeProjects = projects.filter((p) => p.status === "IN_PROGRESS");
  const selectedProject = projects.find((p) => p.id === projectId);

  const weekTotal = useMemo(
    () =>
      weekStart
        ? mine
            .filter((e) => e.date.slice(0, 10) >= weekStart && e.status !== "REJECTED")
            .reduce((sum, e) => sum + Number(e.hours), 0)
        : 0,
    [mine, weekStart],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hoursInput.replace(",", "."));
    if (!projectId || !date || !description.trim() || !(h >= 0.25 && h <= 24)) return;
    setSaving(true);
    setFeedback(null);
    try {
      await timesheetService.log({
        project_id: projectId,
        task_id: taskId || undefined,
        date,
        hours: h,
        description: description.trim(),
      });
      setFeedback({ kind: "success", text: `${hours(h)} h déclarées sur ${selectedProject?.name}. En attente de validation.` });
      setHoursInput("");
      setDescription("");
      setMineKey((k) => k + 1);
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setSaving(false);
    }
  };

  /* ── Validation ─────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<TimeEntryStatus | "">("SUBMITTED");
  const [team, setTeam] = useState<TimeEntry[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamKey, setTeamKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TimeEntry | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!canApprove) return;
    let cancelled = false;
    Promise.all([
      timesheetService.teamEntries({ status: statusFilter || undefined }),
      timesheetService.teamEntries({ status: "SUBMITTED" }),
    ])
      .then(([page, pending]) => {
        if (cancelled) return;
        setTeam(page.data ?? []);
        setPendingCount(pending.total);
        setTeamError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setTeamError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canApprove, statusFilter, teamKey]);

  const review = async (entry: TimeEntry, action: "APPROVE" | "REJECT", reason?: string) => {
    setBusyId(entry.id);
    setFeedback(null);
    try {
      const res = await timesheetService.review(entry.id, action, reason);
      setFeedback({ kind: "success", text: res.message });
      setRejectTarget(null);
      setRejectReason("");
      setTeamLoading(true);
      setTeamKey((k) => k + 1);
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🕒 Feuilles de temps</h1>
            <p className="text-xs text-slate-400 mt-1">
              Déclaration des heures par projet et tâche, validation par le responsable (&sect;3.5)
            </p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setTab("mine")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg ${tab === "mine" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Mes heures
            </button>
            {canApprove && (
              <button
                onClick={() => setTab("review")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${tab === "review" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Validation
                {pendingCount > 0 && (
                  <span className="min-w-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">{pendingCount}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mt-6 px-4 py-3 rounded-xl text-sm border ${
              feedback.kind === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
          </div>
        )}

        {tab === "mine" ? (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-8">
            {/* Déclaration */}
            <form onSubmit={submit} className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 h-fit">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-bold text-white">Déclarer des heures</h2>
                <span className="text-xs text-slate-400">
                  Cette semaine : <span className="text-white font-semibold">{hours(weekTotal)} h</span>
                </span>
              </div>
              {mineError ? (
                <p className="text-sm text-rose-300">⚠️ {mineError}</p>
              ) : activeProjects.length === 0 && !mineLoading ? (
                <p className="text-sm text-slate-400">Aucun projet en cours pour le moment.</p>
              ) : (
                <>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Projet</span>
                    <select
                      value={projectId}
                      onChange={(e) => {
                        setProjectId(e.target.value);
                        setTaskId("");
                      }}
                      required
                      className={inputCls}
                    >
                      <option value="">— Choisir un projet —</option>
                      {activeProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.code ? ` (${p.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Tâche (facultatif)</span>
                    <select
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      disabled={!selectedProject || selectedProject.tasks.length === 0}
                      className={inputCls + " disabled:opacity-50"}
                    >
                      <option value="">— Aucune tâche précise —</option>
                      {selectedProject?.tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-slate-400 mb-1">Date</span>
                      <input type="date" value={date} max={today || undefined} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-slate-400 mb-1">Heures</span>
                      <input
                        type="number"
                        min={0.25}
                        max={24}
                        step={0.25}
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        placeholder="ex. 7,5"
                        required
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Travail réalisé</span>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez brièvement le travail effectué…"
                      required
                      className={inputCls}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving || !projectId || !hoursInput || !description.trim()}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl"
                  >
                    {saving ? "Envoi…" : "Soumettre pour validation"}
                  </button>
                </>
              )}
            </form>

            {/* Historique personnel */}
            <section className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h2 className="text-base font-bold text-white">Mes saisies</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Projet / tâche</th>
                      <th className="py-3 px-4 font-semibold text-right">Heures</th>
                      <th className="py-3 px-4 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mineLoading && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">Chargement…</td>
                      </tr>
                    )}
                    {!mineLoading && mine.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Aucune heure déclarée.</td>
                      </tr>
                    )}
                    {!mineLoading &&
                      mine.map((e) => (
                        <tr key={e.id} className="align-top hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="py-3 px-4">
                            <div className="text-white text-sm">{e.project?.name ?? "—"}</div>
                            <div className="text-xs text-slate-500">{e.task?.title ?? e.description}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{hours(e.hours)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS[e.status]?.cls}`}>
                              {STATUS[e.status]?.label ?? e.status}
                            </span>
                            {e.status === "REJECTED" && e.rejection_reason && (
                              <p className="text-[11px] text-rose-300 mt-1">{e.rejection_reason}</p>
                            )}
                            {e.status === "APPROVED" && e.approver && (
                              <p className="text-[11px] text-slate-500 mt-1">par {e.approver.name}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Heures de mon périmètre</h2>
                <p className="text-xs text-slate-400">Saisies sur vos projets ou de vos collaborateurs directs.</p>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setTeamLoading(true);
                  setStatusFilter(e.target.value as TimeEntryStatus | "");
                }}
                aria-label="Filtrer par statut"
                className={inputCls + " md:w-44"}
              >
                <option value="SUBMITTED">En attente</option>
                <option value="APPROVED">Validées</option>
                <option value="REJECTED">Rejetées</option>
                <option value="">Toutes</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Collaborateur</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Projet / travail</th>
                    <th className="py-3 px-4 font-semibold text-right">Heures</th>
                    <th className="py-3 px-4 font-semibold text-right">Décision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {teamLoading && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Chargement…</td>
                    </tr>
                  )}
                  {!teamLoading && teamError && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-rose-300">⚠️ {teamError}</td>
                    </tr>
                  )}
                  {!teamLoading && !teamError && team.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucune saisie pour ce filtre.</td>
                    </tr>
                  )}
                  {!teamLoading &&
                    !teamError &&
                    team.map((e) => (
                      <tr key={e.id} className="align-top hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="text-white">
                            {e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : "—"}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{e.employee?.matricule}</div>
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="text-white text-sm">
                            {e.project?.name}
                            {e.task && <span className="text-slate-400"> &bull; {e.task.title}</span>}
                          </div>
                          <div className="text-xs text-slate-400">{e.description}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{hours(e.hours)}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {e.status === "SUBMITTED" ? (
                            <>
                              <button
                                onClick={() => review(e, "APPROVE")}
                                disabled={busyId !== null}
                                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded"
                              >
                                {busyId === e.id ? "…" : "Valider"}
                              </button>
                              <button
                                onClick={() => setRejectTarget(e)}
                                disabled={busyId !== null}
                                className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-300 rounded border border-rose-500/30"
                              >
                                Rejeter
                              </button>
                            </>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS[e.status]?.cls}`}>
                              {STATUS[e.status]?.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-1">Rejeter la saisie</h3>
              <p className="text-sm text-slate-400 mb-4">
                {hours(rejectTarget.hours)} h le {formatDate(rejectTarget.date)} sur {rejectTarget.project?.name}
              </p>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Motif (obligatoire)</span>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex : préciser la tâche concernée…"
                  className={inputCls + " mb-4"}
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => review(rejectTarget, "REJECT", rejectReason.trim())}
                  disabled={!rejectReason.trim() || busyId !== null}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
