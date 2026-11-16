"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import EmployeeDrawer from "@/components/employees/EmployeeDrawer";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { employeeService, type EmployeeItem, type EmployeeStatus, type Structure } from "@/lib/services/employeeService";

const STATUS: Record<EmployeeStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  ON_LEAVE: { label: "En congé", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  SUSPENDED: { label: "Suspendu", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  TERMINATED: { label: "Sorti", cls: "bg-slate-500/15 text-slate-400 border-slate-600" },
};

const inputCls =
  "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—");

export default function EmployeesPage() {
  const { user } = useAuth();
  const permissions = {
    canEdit: hasPermission(user, "employees.create_edit"),
    canContracts: hasPermission(user, "contracts.manage"),
    canReadDocs: hasPermission(user, "documents.read_confidential") || hasPermission(user, "documents.upload"),
    canUploadDocs: hasPermission(user, "documents.upload"),
    canAccounts: hasPermission(user, "roles.manage"),
  };

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [structure, setStructure] = useState<Structure>({ departments: [], positions: [] });
  const [managers, setManagers] = useState<{ id: string; full_name: string; matricule: string }[]>([]);
  const [drawer, setDrawer] = useState<{ employee: EmployeeItem | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    employeeService
      .list({ search: debounced || undefined, status: status || undefined, department_id: department || undefined, page })
      .then((res) => {
        if (cancelled) return;
        setEmployees(res.data ?? []);
        setTotal(res.meta?.total ?? res.data?.length ?? 0);
        setLastPage(res.meta?.last_page ?? 1);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 401
            ? "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel."
            : err instanceof Error
              ? err.message
              : "Chargement impossible.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, status, department, page, reloadKey]);

  // Référentiels (services, postes, responsables possibles)
  useEffect(() => {
    let cancelled = false;
    Promise.all([employeeService.structure(), employeeService.list({ per_page: 100, status: "ACTIVE" })])
      .then(([s, list]) => {
        if (cancelled) return;
        setStructure(s);
        setManagers(list.data.map((e) => ({ id: e.id, full_name: e.full_name, matricule: e.matricule })));
      })
      .catch(() => {
        /* les listes de choix restent vides ; l'erreur principale est affichée par la liste */
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filter = (fn: () => void) => {
    setLoading(true);
    setPage(1);
    fn();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">👥 Collaborateurs &amp; dossiers RH</h1>
            <p className="text-xs text-slate-400 mt-1">Fiches, affectations, contrats, pièces justificatives et comptes de connexion (&sect;3.4)</p>
          </div>
          {permissions.canEdit && (
            <button onClick={() => setDrawer({ employee: null })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold">
              + Nouveau collaborateur
            </button>
          )}
        </div>

        <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Nom, matricule ou e-mail…"
              aria-label="Rechercher un collaborateur"
              className={inputCls + " w-full md:w-72"}
            />
            <select value={department} onChange={(e) => filter(() => setDepartment(e.target.value))} aria-label="Service" className={inputCls}>
              <option value="">Tous les services</option>
              {structure.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => filter(() => setStatus(e.target.value))} aria-label="Statut" className={inputCls}>
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUS) as EmployeeStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-500">{total} collaborateur(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Collaborateur</th>
                  <th className="py-3 px-4 font-semibold">Service &amp; poste</th>
                  <th className="py-3 px-4 font-semibold">Responsable</th>
                  <th className="py-3 px-4 font-semibold">Contrat</th>
                  <th className="py-3 px-4 font-semibold">Statut</th>
                  <th className="py-3 px-4 font-semibold text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-rose-300">
                      ⚠️ {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && employees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucun collaborateur ne correspond.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  employees.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium flex items-center gap-2">
                          {e.full_name}
                          {!e.has_account && (
                            <span title="Pas de compte de connexion" className="text-[10px] text-slate-500 border border-slate-700 rounded px-1">
                              sans compte
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{e.matricule}</span> &bull; {e.email ?? "sans e-mail"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white text-sm">{e.position?.title ?? "—"}</div>
                        <div className="text-xs text-slate-500">{e.department?.name ?? "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{e.manager?.full_name ?? "—"}</td>
                      <td className="py-3 px-4 text-xs">
                        {e.current_contract ? (
                          <>
                            <span className="text-white">{e.current_contract.type}</span>
                            <span className="block text-slate-500">{e.current_contract.end_date ? `jusqu'au ${fmt(e.current_contract.end_date)}` : `depuis le ${fmt(e.current_contract.start_date)}`}</span>
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS[e.status]?.cls}`}>{STATUS[e.status]?.label ?? e.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setDrawer({ employee: e })} className="px-3 py-1.5 text-xs font-medium text-sky-300 border border-sky-500/30 rounded-lg hover:bg-sky-500/10">
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {lastPage > 1 && (
            <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <button
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
              >
                ← Précédent
              </button>
              <span>
                Page {page} / {lastPage}
              </span>
              <button
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.min(lastPage, p + 1));
                }}
                disabled={page >= lastPage}
                className="px-3 py-1.5 bg-slate-800 rounded disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          )}
        </section>
      </main>

      {drawer && (
        <EmployeeDrawer
          key={drawer.employee?.id ?? "new"}
          employee={drawer.employee}
          structure={structure}
          managers={managers}
          permissions={permissions}
          onClose={() => setDrawer(null)}
          onSaved={(saved) => {
            setDrawer({ employee: saved });
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
