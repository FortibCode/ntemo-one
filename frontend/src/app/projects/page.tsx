"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { apiClient, ApiError } from "@/lib/api";
import {
  projectService,
  type Priority,
  type ProjectDetail,
  type ProjectStatus,
  type ProjectSummary,
  type TaskItem,
  type TaskStatus,
} from "@/lib/services/projectService";

interface EmployeeOption {
  id: string;
  full_name: string;
  matricule: string;
}

type Feedback = { kind: "success" | "error"; text: string };

const PROJECT_STATUS: Record<ProjectStatus, { label: string; cls: string }> = {
  PLANNED: { label: "Planifié", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  IN_PROGRESS: { label: "En cours", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  ON_HOLD: { label: "En pause", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  COMPLETED: { label: "Terminé", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  CANCELLED: { label: "Annulé", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

const TASK_STATUS: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  REVIEW: "En revue",
  DONE: "Terminée",
};

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  LOW: { label: "Basse", cls: "text-slate-400" },
  MEDIUM: { label: "Moyenne", cls: "text-sky-300" },
  HIGH: { label: "Haute", cls: "text-amber-300" },
  URGENT: { label: "Urgente", cls: "text-rose-300 font-semibold" },
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

const formatDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR") : "—");
const fmtHours = (h: number) => h.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/* ── Barre d'avancement ─────────────────────────────────────── */
function Progress({ value }: { value: number }) {
  return (
    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}

/* ── Ligne de tâche ─────────────────────────────────────────── */
function TaskRow({
  task,
  busy,
  showProject,
  onStatus,
  onDelete,
}: {
  task: TaskItem;
  busy: boolean;
  showProject?: boolean;
  onStatus: (t: TaskItem, s: TaskStatus) => void;
  onDelete?: (t: TaskItem) => void;
}) {
  return (
    <li className="py-3 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === "DONE" ? "text-slate-500 line-through" : "text-white"}`}>{task.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {showProject && task.project && <span className="text-slate-400">{task.project.name} &bull; </span>}
          {task.assignee ? task.assignee.full_name : "Non attribuée"} &bull;{" "}
          <span className={PRIORITY[task.priority]?.cls}>{PRIORITY[task.priority]?.label}</span>
          {task.estimated_hours !== null && (
            <> &bull; {fmtHours(task.approved_hours)} / {fmtHours(task.estimated_hours)} h</>
          )}
        </p>
      </div>
      <span className={`text-xs whitespace-nowrap ${task.is_overdue ? "text-rose-300 font-semibold" : "text-slate-400"}`}>
        {task.due_date ? (task.is_overdue ? `⚠ En retard (${formatDate(task.due_date)})` : `Échéance ${formatDate(task.due_date)}`) : "Sans échéance"}
      </span>
      <div className="flex items-center gap-2">
        {task.can_update_status ? (
          <select
            value={task.status}
            onChange={(e) => onStatus(task, e.target.value as TaskStatus)}
            disabled={busy}
            aria-label={`Statut de la tâche ${task.title}`}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
          >
            {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-400">{TASK_STATUS[task.status]}</span>
        )}
        {onDelete && task.can_manage && (
          <button
            onClick={() => onDelete(task)}
            disabled={busy}
            aria-label={`Supprimer la tâche ${task.title}`}
            className="text-xs text-slate-500 hover:text-rose-300 px-1"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const canCreate = hasPermission(user, "projects.manage");

  const [tab, setTab] = useState<"projects" | "mine">("projects");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailKey, setDetailKey] = useState(0);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [myTasks, setMyTasks] = useState<TaskItem[]>([]);
  const [myKey, setMyKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", code: "", description: "", start_date: "", end_date: "", status: "PLANNED" as ProjectStatus });
  const [newTask, setNewTask] = useState({ title: "", assigned_to: "", priority: "MEDIUM" as Priority, due_date: "", estimated_hours: "" });

  // Projets
  useEffect(() => {
    let cancelled = false;
    projectService
      .list()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        setLoadError(null);
        setSelectedId((id) => id ?? list[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listKey]);

  // Détail du projet sélectionné
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    projectService
      .get(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailKey]);

  // Collaborateurs attribuables (équipe ou organisation selon les droits)
  useEffect(() => {
    if (!detail?.can_manage || employees.length > 0) return;
    let cancelled = false;
    apiClient
      .get<{ data: EmployeeOption[] }>("/employees", { per_page: 100 })
      .then((res) => {
        if (!cancelled) setEmployees(res.data ?? []);
      })
      .catch(() => {
        /* la liste d'attribution reste vide : la tâche peut être créée sans assigné */
      });
    return () => {
      cancelled = true;
    };
  }, [detail?.can_manage, employees.length]);

  // Mes tâches
  useEffect(() => {
    if (tab !== "mine") return;
    let cancelled = false;
    projectService
      .myTasks()
      .then((t) => {
        if (!cancelled) setMyTasks(t);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, myKey]);

  const refreshAll = () => {
    setListKey((k) => k + 1);
    setDetailKey((k) => k + 1);
    setMyKey((k) => k + 1);
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", text: success });
      refreshAll();
      return true;
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () =>
        projectService
          .create({
            name: newProject.name.trim(),
            code: newProject.code.trim() || null,
            description: newProject.description.trim() || null,
            start_date: newProject.start_date,
            end_date: newProject.end_date || null,
            status: newProject.status,
          })
          .then((p) => setSelectedId(p.id)),
      `Projet « ${newProject.name.trim()} » créé.`,
    );
    if (ok) {
      setCreateOpen(false);
      setNewProject({ name: "", code: "", description: "", start_date: "", end_date: "", status: "PLANNED" });
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newTask.title.trim()) return;
    const ok = await run(
      () =>
        projectService.createTask(detail.id, {
          title: newTask.title.trim(),
          assigned_to: newTask.assigned_to || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          estimated_hours: newTask.estimated_hours ? Number(newTask.estimated_hours) : null,
        }),
      newTask.assigned_to ? "Tâche créée et collaborateur notifié." : "Tâche créée.",
    );
    if (ok) setNewTask({ title: "", assigned_to: "", priority: "MEDIUM", due_date: "", estimated_hours: "" });
  };

  const setTaskStatus = (task: TaskItem, status: TaskStatus) =>
    run(() => projectService.updateTask(task.id, { status }), `« ${task.title} » : ${TASK_STATUS[status]}.`);

  const deleteTask = (task: TaskItem) => {
    if (!window.confirm(`Supprimer la tâche « ${task.title} » ?`)) return;
    run(() => projectService.deleteTask(task.id), "Tâche supprimée.");
  };

  const setProjectStatus = (status: ProjectStatus) =>
    detail && run(() => projectService.update(detail.id, { status }), `Projet passé au statut « ${PROJECT_STATUS[status].label} ».`);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">📈 Projets &amp; tâches</h1>
            <p className="text-xs text-slate-400 mt-1">Suivi des projets, attribution des tâches, échéanciers et alertes de retard (&sect;3.5)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              {(["projects", "mine"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg ${tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {t === "projects" ? "Projets" : "Mes tâches"}
                </button>
              ))}
            </div>
            {canCreate && (
              <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold">
                + Nouveau projet
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mt-6 px-4 py-3 rounded-xl text-sm border ${
              feedback.kind === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
          </div>
        )}

        {tab === "mine" ? (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white">Tâches qui me sont attribuées</h2>
            {myTasks.length === 0 ? (
              <p className="text-sm text-slate-500 mt-4">Aucune tâche attribuée.</p>
            ) : (
              <ul className="divide-y divide-slate-800 mt-2">
                {myTasks.map((t) => (
                  <TaskRow key={t.id} task={t} busy={busy} showProject onStatus={setTaskStatus} />
                ))}
              </ul>
            )}
          </section>
        ) : loading ? (
          <div className="mt-8 p-10 text-center text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">Chargement des projets…</div>
        ) : loadError ? (
          <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-sm text-rose-300">⚠️ {loadError}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-8">
            {/* ── Catalogue ───────────────────────── */}
            <section className="xl:col-span-2 space-y-3" aria-label="Projets">
              {projects.length === 0 && <p className="text-sm text-slate-400">Aucun projet pour le moment.</p>}
              {projects.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    aria-pressed={active}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${active ? "bg-sky-500/10 border-sky-500/50" : "bg-slate-900 border-slate-800 hover:border-slate-600"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.code ?? "—"} &bull; {p.project_manager?.full_name ?? "Sans responsable"}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PROJECT_STATUS[p.status]?.cls}`}>
                        {PROJECT_STATUS[p.status]?.label}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Progress value={p.stats.progress_percentage} />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                      <span>
                        {p.stats.tasks_done}/{p.stats.tasks_total} tâches &bull; {p.stats.progress_percentage} %
                      </span>
                      <span>
                        {p.stats.tasks_overdue > 0 && <span className="text-rose-300 font-semibold">⚠ {p.stats.tasks_overdue} en retard &bull; </span>}
                        {p.is_late && <span className="text-rose-300 font-semibold">échéance dépassée &bull; </span>}
                        fin {formatDate(p.end_date)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </section>

            {/* ── Détail ──────────────────────────── */}
            <section className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
              {!detail ? (
                <p className="text-sm text-slate-400">Sélectionnez un projet.</p>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">{detail.name}</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(detail.start_date)} → {formatDate(detail.end_date)} &bull; Responsable : {detail.project_manager?.full_name ?? "—"}
                      </p>
                      {detail.description && <p className="text-sm text-slate-300 mt-2 max-w-xl">{detail.description}</p>}
                    </div>
                    {detail.can_manage ? (
                      <select
                        value={detail.status}
                        onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                        disabled={busy}
                        aria-label="Statut du projet"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      >
                        {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {PROJECT_STATUS[s].label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PROJECT_STATUS[detail.status]?.cls}`}>{PROJECT_STATUS[detail.status]?.label}</span>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {[
                      ["Avancement", `${detail.stats.progress_percentage} %`],
                      ["Tâches en retard", String(detail.stats.tasks_overdue)],
                      ["Heures validées", `${fmtHours(detail.stats.approved_hours)} h`],
                      ["Heures estimées", `${fmtHours(detail.stats.estimated_hours)} h`],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                        <dt className="text-[11px] text-slate-500 uppercase tracking-wider">{k}</dt>
                        <dd className="text-lg font-bold text-white mt-0.5">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="text-sm font-bold text-white mt-6">Tâches</h3>
                  {detail.tasks.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-2">Aucune tâche.</p>
                  ) : (
                    <ul className="divide-y divide-slate-800">
                      {detail.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} busy={busy} onStatus={setTaskStatus} onDelete={deleteTask} />
                      ))}
                    </ul>
                  )}

                  {detail.can_manage && (
                    <form onSubmit={addTask} className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
                      <label className="col-span-full block">
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Nouvelle tâche</span>
                        <input
                          value={newTask.title}
                          onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                          placeholder="Intitulé de la tâche…"
                          maxLength={255}
                          className={inputCls}
                        />
                      </label>
                      <select
                        value={newTask.assigned_to}
                        onChange={(e) => setNewTask((t) => ({ ...t, assigned_to: e.target.value }))}
                        aria-label="Attribuer à"
                        className={inputCls}
                      >
                        <option value="">Non attribuée</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value as Priority }))}
                        aria-label="Priorité"
                        className={inputCls}
                      >
                        {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY[p].label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask((t) => ({ ...t, due_date: e.target.value }))}
                        aria-label="Échéance"
                        className={inputCls}
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={newTask.estimated_hours}
                        onChange={(e) => setNewTask((t) => ({ ...t, estimated_hours: e.target.value }))}
                        placeholder="Heures estimées"
                        aria-label="Heures estimées"
                        className={inputCls}
                      />
                      <button
                        type="submit"
                        disabled={busy || !newTask.title.trim()}
                        className="col-span-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl"
                      >
                        Ajouter la tâche
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {createOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <form onSubmit={createProject} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4">
              <h3 className="text-lg font-bold text-white">Nouveau projet</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block md:col-span-2">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">Nom</span>
                  <input required value={newProject.name} onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">Code</span>
                  <input value={newProject.code} onChange={(e) => setNewProject((p) => ({ ...p, code: e.target.value }))} placeholder="PRJ-…" className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Description</span>
                <textarea rows={3} value={newProject.description} onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))} className={inputCls} />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">Début</span>
                  <input type="date" required value={newProject.start_date} onChange={(e) => setNewProject((p) => ({ ...p, start_date: e.target.value }))} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">Fin prévue</span>
                  <input type="date" min={newProject.start_date || undefined} value={newProject.end_date} onChange={(e) => setNewProject((p) => ({ ...p, end_date: e.target.value }))} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">Statut</span>
                  <select value={newProject.status} onChange={(e) => setNewProject((p) => ({ ...p, status: e.target.value as ProjectStatus }))} className={inputCls}>
                    {(["PLANNED", "IN_PROGRESS"] as ProjectStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS[s].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">
                  Annuler
                </button>
                <button type="submit" disabled={busy || !newProject.name.trim() || !newProject.start_date} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  Créer le projet
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
