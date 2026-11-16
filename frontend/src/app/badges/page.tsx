"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { apiClient, ApiError } from "@/lib/api";
import { badgeService, type BadgeItem, type BadgeVerification } from "@/lib/services/badgeService";

interface EmployeeOption {
  id: string;
  full_name: string;
  matricule: string;
}

type Feedback = { kind: "success" | "error"; text: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  REVOKED: { label: "Révoqué", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  REPLACED: { label: "Remplacé", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  EXPIRED: { label: "Expiré", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.status === 403) return "Action réservée aux gestionnaires de badges (RH).";
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

const fullName = (b: BadgeItem) =>
  b.employee ? b.employee.full_name ?? `${b.employee.first_name} ${b.employee.last_name}` : "—";

const formatDate = (d: string | null) => (d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("fr-FR") : "—");

/** Un badge « actif » dont la date d'expiration est passée est affiché comme expiré. */
function effectiveStatus(b: BadgeItem): string {
  if (b.status === "ACTIVE" && b.expires_at && b.expires_at.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    return "EXPIRED";
  }
  return b.status;
}

export default function BadgesPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "badges.generate_revoke");

  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueEmployee, setIssueEmployee] = useState("");
  const [issueExpiry, setIssueExpiry] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [revokeTarget, setRevokeTarget] = useState<BadgeItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const [verifyToken, setVerifyToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<BadgeVerification | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    badgeService
      .list({ search: debouncedSearch || undefined, status: statusFilter || undefined, page })
      .then((res) => {
        if (cancelled) return;
        setBadges(res.data);
        setTotal(res.total);
        setLastPage(res.last_page);
        setLoadError(null);
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
  }, [canManage, debouncedSearch, statusFilter, page, reloadKey]);

  // Collaborateurs pour l'émission (chargés à l'ouverture de la fenêtre)
  useEffect(() => {
    if (!issueOpen || employees.length > 0) return;
    let cancelled = false;
    apiClient
      .get<{ data: EmployeeOption[] }>("/employees", { per_page: 100 })
      .then((res) => {
        if (!cancelled) setEmployees(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [issueOpen, employees.length]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    return q ? employees.filter((e) => `${e.full_name} ${e.matricule}`.toLowerCase().includes(q)) : employees;
  }, [employees, employeeSearch]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueEmployee) return;
    setBusyId("issue");
    setFeedback(null);
    try {
      const badge = await badgeService.issue(issueEmployee, issueExpiry || undefined);
      setFeedback({
        kind: "success",
        text: `Badge ${badge.badge_number} émis. L'éventuel badge précédent du collaborateur a été remplacé.`,
      });
      setIssueOpen(false);
      setIssueEmployee("");
      setIssueExpiry("");
      reload();
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setBusyId(revokeTarget.id);
    setFeedback(null);
    try {
      await badgeService.revoke(revokeTarget.id, revokeReason.trim());
      setFeedback({ kind: "success", text: `Badge ${revokeTarget.badge_number} révoqué : il est refusé immédiatement.` });
      setRevokeTarget(null);
      setRevokeReason("");
      reload();
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handlePrint = async (badge: BadgeItem) => {
    setBusyId(badge.id);
    setFeedback(null);
    try {
      await badgeService.print(badge);
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken.trim()) return;
    setVerifying(true);
    setVerification(null);
    try {
      setVerification(await badgeService.verify(verifyToken.trim()));
    } catch (err) {
      setVerification({ is_valid: false, message: describe(err) });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🪪 Badges numériques</h1>
            <p className="text-xs text-slate-400 mt-1">
              Émission, impression recto/verso (PDF format carte), révocation instantanée et contrôle (&sect;3.2)
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setIssueOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
            >
              + Émettre un badge
            </button>
          )}
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

        {!canManage ? (
          <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300 max-w-2xl">
            🔒 La gestion des badges est réservée aux RH. Votre badge virtuel est disponible dans l&rsquo;application
            mobile NTEMO ONE (onglet « Badge »).
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mt-8">
            {/* ── Liste ─────────────────────────────── */}
            <section className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <h2 className="text-base font-bold text-white">
                  Badges émis <span className="text-slate-500 font-normal text-sm">({total})</span>
                </h2>
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Nom ou matricule…"
                    aria-label="Rechercher un badge"
                    className={inputCls + " md:w-56"}
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filtrer par statut"
                    className={inputCls + " md:w-40"}
                  >
                    <option value="">Tous statuts</option>
                    <option value="ACTIVE">Actifs</option>
                    <option value="REVOKED">Révoqués</option>
                    <option value="REPLACED">Remplacés</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Collaborateur</th>
                      <th className="py-3 px-4 font-semibold">N° badge</th>
                      <th className="py-3 px-4 font-semibold">Émis / Expire</th>
                      <th className="py-3 px-4 font-semibold">Statut</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loading && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chargement…
                        </td>
                      </tr>
                    )}
                    {!loading && loadError && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-rose-300">
                          ⚠️ {loadError}{" "}
                          <button onClick={reload} className="underline ml-1">
                            Réessayer
                          </button>
                        </td>
                      </tr>
                    )}
                    {!loading && !loadError && badges.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Aucun badge ne correspond.
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      !loadError &&
                      badges.map((b) => {
                        const status = effectiveStatus(b);
                        const meta = STATUS[status] ?? { label: status, cls: "bg-slate-800 text-slate-300 border-slate-700" };
                        return (
                          <tr key={b.id} className="hover:bg-slate-800/30 align-top">
                            <td className="py-3 px-4">
                              <div className="text-white font-medium">{fullName(b)}</div>
                              <div className="text-xs text-slate-500">
                                <span className="font-mono">{b.employee?.matricule}</span>
                                {b.employee?.position?.title && <> &bull; {b.employee.position.title}</>}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{b.badge_number}</td>
                            <td className="py-3 px-4 text-xs whitespace-nowrap">
                              {formatDate(b.issued_at)}
                              <span className="block text-slate-500">→ {b.expires_at ? formatDate(b.expires_at) : "sans limite"}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>{meta.label}</span>
                              {b.revocation_reason && (
                                <p className="text-[11px] text-slate-500 mt-1 max-w-[16rem]">{b.revocation_reason}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                              {status === "ACTIVE" ? (
                                <>
                                  <button
                                    onClick={() => handlePrint(b)}
                                    disabled={busyId !== null}
                                    className="px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded"
                                  >
                                    {busyId === b.id ? "…" : "🖨️ Imprimer"}
                                  </button>
                                  <button
                                    onClick={() => setRevokeTarget(b)}
                                    disabled={busyId !== null}
                                    className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-300 rounded border border-rose-500/30"
                                  >
                                    Révoquer
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {lastPage > 1 && (
                <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  <span>
                    Page {page} / {lastPage}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    disabled={page >= lastPage}
                    className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </section>

            {/* ── Contrôle d'accès ─────────────────── */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit">
              <h2 className="text-base font-bold text-white">🔍 Contrôler un badge</h2>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Collez le contenu du QR code scanné au verso d&rsquo;un badge pour vérifier sa validité en temps réel.
              </p>
              <form onSubmit={handleVerify} className="space-y-3">
                <textarea
                  rows={3}
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Jeton de sécurité du badge…"
                  aria-label="Jeton de sécurité"
                  className={inputCls + " font-mono text-xs"}
                />
                <button
                  type="submit"
                  disabled={!verifyToken.trim() || verifying}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl border border-slate-700"
                >
                  {verifying ? "Vérification…" : "Vérifier"}
                </button>
              </form>
              {verification && (
                <div
                  role="status"
                  className={`mt-4 p-3 rounded-xl border text-sm ${
                    verification.is_valid
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {verification.is_valid && verification.employee ? (
                    <>
                      <p className="font-bold">✅ Badge valide</p>
                      <p className="text-white mt-1">{verification.employee.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {verification.employee.matricule} &bull; {verification.employee.position ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {verification.badge_number} &bull; expire : {verification.expires_at ? formatDate(verification.expires_at) : "sans limite"}
                      </p>
                    </>
                  ) : (
                    <p>⛔ {verification.message ?? "Badge refusé."}</p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Émission ─────────────────────────────── */}
        {issueOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <form onSubmit={handleIssue} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">Émettre un badge</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Si le collaborateur possède déjà un badge actif, celui-ci sera automatiquement remplacé.
                </p>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Collaborateur</span>
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className={inputCls + " mb-2"}
                />
                <select
                  value={issueEmployee}
                  onChange={(e) => setIssueEmployee(e.target.value)}
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
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Date d&rsquo;expiration (optionnelle)</span>
                <input type="date" value={issueExpiry} onChange={(e) => setIssueExpiry(e.target.value)} className={inputCls} />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIssueOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!issueEmployee || busyId !== null}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {busyId === "issue" ? "Émission…" : "Émettre"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Révocation ───────────────────────────── */}
        {revokeTarget && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-1">Révoquer le badge</h3>
              <p className="text-sm text-slate-400 mb-4">
                {fullName(revokeTarget)} — <span className="font-mono">{revokeTarget.badge_number}</span>. Le badge sera
                refusé immédiatement, y compris s&rsquo;il a été imprimé.
              </p>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Motif (obligatoire)</span>
                <textarea
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Ex : perte déclarée, fin de contrat…"
                  className={inputCls + " mb-4"}
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRevokeTarget(null);
                    setRevokeReason("");
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={!revokeReason.trim() || busyId !== null}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Confirmer la révocation
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
