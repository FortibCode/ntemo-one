"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { apiClient, ApiError } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  user: { id: string; name: string; email: string } | null;
}

interface AuditPage {
  data: AuditEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

/** Libellés lisibles des actions tracées. */
const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login_failed": "Échec de connexion",
  "auth.logout": "Déconnexion",
  "role.assigned": "Rôle attribué",
  "role.revoked": "Rôle retiré",
  "settings.updated": "Paramètres modifiés",
  "settings.attendance_updated": "Paramètres de pointage modifiés",
  "badge.issued": "Badge émis",
  "badge.revoked": "Badge révoqué",
  "badge.printed": "Badge imprimé",
  "attendance.correction_approved": "Régularisation approuvée",
  "attendance.correction_rejected": "Régularisation rejetée",
  "timesheet.approved": "Feuille de temps validée",
  "timesheet.rejected": "Feuille de temps rejetée",
  "leave.reviewed_n1": "Décision congé N+1",
  "leave.reviewed_hr": "Décision congé RH",
  "document.generated": "Document généré",
  "document.downloaded": "Document téléchargé",
  "employee.created": "Collaborateur créé",
  "employee.updated": "Fiche collaborateur modifiée",
  "employee.archived": "Collaborateur archivé",
  "report.attendance_exported": "Bilan de présence exporté",
  "project.created": "Projet créé",
  "project.updated": "Projet modifié",
  "task.deleted": "Tâche supprimée",
  "ged.uploaded": "Pièce RH ajoutée",
  "ged.downloaded": "Pièce RH consultée",
  "ged.deleted": "Pièce RH retirée",
};

const MODULES: { value: string; label: string }[] = [
  { value: "", label: "Tous les modules" },
  { value: "auth", label: "Connexions" },
  { value: "role", label: "Rôles" },
  { value: "settings", label: "Paramètres" },
  { value: "employee", label: "Collaborateurs" },
  { value: "ged", label: "GED" },
  { value: "badge", label: "Badges" },
  { value: "attendance", label: "Présences" },
  { value: "leave", label: "Congés" },
  { value: "timesheet", label: "Feuilles de temps" },
  { value: "project", label: "Projets" },
  { value: "document", label: "Documents" },
  { value: "report", label: "Rapports" },
];

const SENSITIVE = new Set(["auth.login_failed", "role.assigned", "role.revoked", "badge.revoked", "employee.archived", "ged.deleted", "settings.updated"]);

const inputCls =
  "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500";

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Changes({ entry }: { entry: AuditEntry }) {
  const keys = Array.from(new Set([...Object.keys(entry.old_values ?? {}), ...Object.keys(entry.new_values ?? {})]));
  if (keys.length === 0) return <span className="text-slate-600">—</span>;
  return (
    <dl className="space-y-0.5">
      {keys.map((k) => (
        <div key={k} className="text-xs break-all">
          <dt className="inline text-slate-500">{k} : </dt>
          <dd className="inline">
            {entry.old_values && k in entry.old_values && (
              <span className="text-rose-300 line-through mr-1">{formatValue(entry.old_values[k])}</span>
            )}
            {entry.new_values && k in entry.new_values && <span className="text-emerald-300">{formatValue(entry.new_values[k])}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "audit.view");

  const [module, setModule] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    apiClient
      .get<AuditPage>("/audit-logs", { module: module || undefined, from: from || undefined, to: to || undefined, page })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : err instanceof TypeError ? "Serveur injoignable." : "Chargement impossible.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, module, from, to, page]);

  const applyFilter = (fn: () => void) => {
    setLoading(true);
    setPage(1);
    fn();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">🧾 Journal d&rsquo;audit</h1>
          <p className="text-xs text-slate-400 mt-1">
            Traçabilité des actions sensibles : connexions, droits, dossiers RH, badges, validations et documents (&sect;4)
          </p>
        </div>

        {!canView ? (
          <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300 max-w-2xl">
            🔒 La consultation du journal d&rsquo;audit requiert la permission « Consulter les journaux d&rsquo;audit ».
          </div>
        ) : (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Module</span>
                <select value={module} onChange={(e) => applyFilter(() => setModule(e.target.value))} className={inputCls}>
                  {MODULES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Du</span>
                <input type="date" value={from} onChange={(e) => applyFilter(() => setFrom(e.target.value))} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Au</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => applyFilter(() => setTo(e.target.value))} className={inputCls} />
              </label>
              <span className="ml-auto text-xs text-slate-500">{result ? `${result.total} événement(s)` : ""}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Utilisateur</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Détail</th>
                    <th className="py-3 px-4 font-semibold">Adresse IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Chargement…</td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-rose-300">⚠️ {error}</td>
                    </tr>
                  )}
                  {!loading && !error && result?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucun événement pour ces critères.</td>
                    </tr>
                  )}
                  {!loading &&
                    !error &&
                    result?.data.map((e) => (
                      <tr key={e.id} className="align-top hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-xs whitespace-nowrap font-mono">
                          {e.created_at ? new Date(e.created_at).toLocaleString("fr-FR") : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white text-sm">{e.user?.name ?? "Système / anonyme"}</div>
                          {e.user && <div className="text-xs text-slate-500">{e.user.email}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${SENSITIVE.has(e.action) ? "text-amber-300 font-semibold" : "text-white"}`}>
                            {ACTION_LABELS[e.action] ?? e.action}
                          </span>
                          {e.subject_type && <div className="text-[11px] text-slate-500">{e.subject_type}</div>}
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <Changes entry={e} />
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-400" title={e.user_agent ?? ""}>
                          {e.ip_address ?? "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {result && result.last_page > 1 && (
              <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <button
                  onClick={() => {
                    setLoading(true);
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
                >
                  ← Plus récents
                </button>
                <span>
                  Page {page} / {result.last_page}
                </span>
                <button
                  onClick={() => {
                    setLoading(true);
                    setPage((p) => Math.min(result.last_page, p + 1));
                  }}
                  disabled={page >= result.last_page}
                  className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
                >
                  Plus anciens →
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
