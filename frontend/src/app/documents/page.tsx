"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { apiClient, ApiError } from "@/lib/api";
import {
  documentService,
  type DocumentGeneration,
  type DocumentTemplate,
  type TemplateField,
} from "@/lib/services/documentService";

interface EmployeeOption {
  id: string;
  full_name: string;
  matricule: string;
}

type Feedback = { kind: "success" | "error"; text: string };

const FORMAT_STYLES: Record<string, string> = {
  PDF: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  DOCX: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  XLSX: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PPTX: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.status === 403) return "Action non autorisée pour votre compte.";
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

/** Date saisie (AAAA-MM-JJ) → format officiel JJ/MM/AAAA. */
function formatFieldValue(field: TemplateField, value: string): string {
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  if (field.type === "number" && value !== "" && !Number.isNaN(Number(value))) {
    return new Intl.NumberFormat("fr-FR").format(Number(value));
  }
  return value;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function DocumentsAdminPage() {
  const { user } = useAuth();
  const canGenerate = hasPermission(user, "documents.generate");
  const canExportAttendance = hasPermission(user, "attendance.manage_all");

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [history, setHistory] = useState<DocumentGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyRequest, setHistoryRequest] = useState(0);

  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [month, setMonth] = useState("");
  const [exporting, setExporting] = useState(false);

  // Chargement initial : modèles + collaborateurs
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      documentService.templates(),
      apiClient.get<{ data: EmployeeOption[] }>("/employees", { per_page: 100 }),
    ])
      .then(([tpls, emps]) => {
        if (cancelled) return;
        setTemplates(tpls);
        setEmployees(emps.data ?? []);
        if (tpls.length > 0) setTemplateId(tpls[0].id);
        const now = new Date();
        setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
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
  }, []);

  // Historique (rechargé après chaque génération)
  useEffect(() => {
    let cancelled = false;
    documentService
      .generations()
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        /* l'historique est secondaire : l'erreur principale est déjà affichée */
      });
    return () => {
      cancelled = true;
    };
  }, [historyRequest]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const fields = useMemo(() => template?.available_variables ?? [], [template]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.full_name} ${e.matricule}`.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, DocumentTemplate[]>();
    for (const t of templates) {
      const key = t.category?.name ?? "Autres modèles";
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()];
  }, [templates]);

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    setValues({});
    setFeedback(null);
  };

  const missingFields = fields.filter((f) => !(values[f.key] ?? "").trim());
  const canSubmit = !!template && !!employeeId && missingFields.length === 0 && !generating && canGenerate;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !canSubmit) return;
    setGenerating(true);
    setFeedback(null);
    try {
      const extra = Object.fromEntries(fields.map((f) => [f.key, formatFieldValue(f, values[f.key].trim())]));
      const result = await documentService.generate({
        template_id: template.id,
        employee_id: employeeId,
        extra_variables: extra,
      });
      await documentService.download(result);
      setFeedback({
        kind: "success",
        text: `Document généré et téléchargé. Empreinte SHA-256 : ${result.file_hash_sha256.slice(0, 16)}…`,
      });
      setHistoryRequest((n) => n + 1);
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!month) return;
    setExporting(true);
    setFeedback(null);
    try {
      await documentService.downloadMonthlyAttendance(month);
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">📄 Moteur documentaire</h1>
          <p className="text-xs text-slate-400 mt-1">
            Attestations, contrats, ordres de mission, courriers et présentations en PDF, Word ou PowerPoint, bilans Excel — chaque fichier est
            tracé avec une empreinte SHA-256 (&sect;3.3)
          </p>
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

        {loading ? (
          <div className="mt-8 p-10 text-center text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
            Chargement des modèles…
          </div>
        ) : loadError ? (
          <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-sm text-rose-300">
            ⚠️ {loadError}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-8">
            {/* ── Catalogue des modèles ─────────────────── */}
            <section className="xl:col-span-2 space-y-5" aria-label="Modèles documentaires">
              {grouped.length === 0 && (
                <p className="text-sm text-slate-400">Aucun modèle actif pour votre organisation.</p>
              )}
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{category}</h2>
                  <div className="space-y-2">
                    {items.map((t) => {
                      const active = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTemplate(t.id)}
                          aria-pressed={active}
                          className={`w-full text-left p-4 rounded-xl border transition-colors ${
                            active
                              ? "bg-sky-500/10 border-sky-500/50"
                              : "bg-slate-900 border-slate-800 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-semibold text-white">{t.title}</span>
                            <span
                              className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${
                                FORMAT_STYLES[t.output_format] ?? "bg-slate-800 text-slate-300 border-slate-700"
                              }`}
                            >
                              {t.output_format}
                            </span>
                          </div>
                          {t.description && <p className="text-xs text-slate-400 mt-1">{t.description}</p>}
                          {t.current_version && (
                            <p className="text-[10px] text-slate-500 mt-1">Version {t.current_version.version_number}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            {/* ── Formulaire de génération ──────────────── */}
            <section className="xl:col-span-3 space-y-6">
              <form onSubmit={handleGenerate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white">{template?.title ?? "Choisissez un modèle"}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Les informations du collaborateur et de l&rsquo;organisation sont remplies automatiquement.
                  </p>
                </div>

                {!canGenerate && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    🔒 La génération de documents requiert la permission « Générer des documents ».
                  </p>
                )}

                <div className="space-y-2">
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Collaborateur concerné</span>
                    <input
                      type="search"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Rechercher par nom ou matricule…"
                      className={inputCls}
                    />
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    aria-label="Collaborateur"
                    required
                    className={inputCls}
                  >
                    <option value="">— Sélectionner ({filteredEmployees.length}) —</option>
                    {filteredEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} — {e.matricule}
                      </option>
                    ))}
                  </select>
                </div>

                {fields.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map((field) => (
                      <label key={field.key} className={`block ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">{field.label}</span>
                        {field.type === "textarea" ? (
                          <textarea
                            rows={5}
                            value={values[field.key] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                            value={values[field.key] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                            className={inputCls}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500">
                    {!employeeId
                      ? "Sélectionnez un collaborateur."
                      : missingFields.length > 0
                        ? `À compléter : ${missingFields.map((f) => f.label).join(", ")}.`
                        : "Prêt à générer."}
                  </p>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-shrink-0 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl"
                  >
                    {generating ? "Génération…" : `Générer le ${template?.output_format ?? "document"}`}
                  </button>
                </div>
              </form>

              {canExportAttendance && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-white">📊 Bilan mensuel de présence (Excel)</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Synthèse par collaborateur (jours, retards, heures, taux de présence) avec formules, et détail
                      journalier.
                    </p>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Mois</span>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
                  </label>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={!month || exporting}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl"
                  >
                    {exporting ? "Export…" : "Télécharger .xlsx"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Historique ───────────────────────────────── */}
        {!loading && !loadError && (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Documents générés</h2>
              <p className="text-xs text-slate-400">50 derniers documents, conservés sur le stockage privé.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Document</th>
                    <th className="py-3 px-4 font-semibold">Collaborateur</th>
                    <th className="py-3 px-4 font-semibold">Généré le</th>
                    <th className="py-3 px-4 font-semibold">Taille</th>
                    <th className="py-3 px-4 font-semibold">Empreinte</th>
                    <th className="py-3 px-4 font-semibold text-right">Fichier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Aucun document généré pour le moment.
                      </td>
                    </tr>
                  )}
                  {history.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{g.template ?? g.title}</div>
                        <div className="text-xs text-slate-500">par {g.requested_by ?? "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {g.employee ? (
                          <>
                            {g.employee.full_name}
                            <span className="block font-mono text-slate-500">{g.employee.matricule}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {g.generated_at ? new Date(g.generated_at).toLocaleString("fr-FR") : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs">{formatSize(g.file_size_bytes)}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500" title={g.file_hash_sha256 ?? ""}>
                        {g.file_hash_sha256 ? `${g.file_hash_sha256.slice(0, 12)}…` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {g.status === "COMPLETED" ? (
                          <button
                            type="button"
                            onClick={() =>
                              documentService.download(g).catch((err) => setFeedback({ kind: "error", text: describe(err) }))
                            }
                            className={`text-xs font-bold px-2.5 py-1 rounded border ${
                              FORMAT_STYLES[g.output_format] ?? "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            ⬇ {g.output_format}
                          </button>
                        ) : (
                          <span className="text-xs text-rose-300" title={g.error_message ?? ""}>
                            {g.status === "FAILED" ? "Échec" : "En cours"}
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
      </main>
    </div>
  );
}
