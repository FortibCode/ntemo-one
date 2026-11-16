"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { roleService, type PermissionItem, type RoleSummary } from "@/lib/services/roleService";

/* ── Libellés des modules (slug backend → libellé FR) ────────── */
const MODULE_LABELS: Record<string, string> = {
  employees: "Collaborateurs",
  structure: "Structure (départements & postes)",
  contracts: "Contrats",
  attendance: "Présences",
  leaves: "Congés",
  badges: "Badges",
  documents: "Documents",
  timesheets: "Feuilles de temps",
  projects: "Projets",
  audit: "Audit",
  ai: "Assistant IA",
  administration: "Administration",
};

const MODULE_ORDER = Object.keys(MODULE_LABELS);

/* ── Couleurs par rôle (repli neutre pour les rôles personnalisés) ── */
const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-500/20 text-red-400 border-red-500/30",
  direction_generale: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  rh_administration: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  project_manager: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  employee: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};
const DEFAULT_ROLE_COLOR = "bg-slate-500/20 text-slate-300 border-slate-500/30";

const roleColor = (slug: string) => ROLE_COLORS[slug] ?? DEFAULT_ROLE_COLOR;
const moduleLabel = (module: string) => MODULE_LABELS[module] ?? module;

export default function RolesPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "roles.manage");

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([roleService.list(), roleService.permissions()])
      .then(([roleList, permissionList]) => {
        if (cancelled) return;
        setRoles(roleList);
        setCatalog(permissionList);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setError("Vous n'avez pas la permission de consulter les rôles (permission requise : roles.manage).");
        } else if (err instanceof ApiError && err.status === 401) {
          setError("Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.");
        } else {
          setError(err instanceof Error ? err.message : "Impossible de charger les rôles.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  /* Permissions groupées par module, dans un ordre stable */
  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();
    for (const perm of catalog) {
      const list = groups.get(perm.module) ?? [];
      list.push(perm);
      groups.set(perm.module, list);
    }
    const rank = (m: string) => {
      const i = MODULE_ORDER.indexOf(m);
      return i === -1 ? MODULE_ORDER.length : i;
    };
    return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  }, [catalog]);

  /* Ensembles de permissions par rôle (le super admin a implicitement tout) */
  const grantedByRole = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const role of roles) {
      map.set(
        role.id,
        role.slug === "super_admin" ? new Set(catalog.map((p) => p.slug)) : new Set(role.permissions),
      );
    }
    return map;
  }, [roles, catalog]);

  const isGranted = (role: RoleSummary, slug: string) => grantedByRole.get(role.id)?.has(slug) ?? false;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">🔐 Gestion des Rôles &amp; Permissions</h1>
            <p className="text-sm text-slate-400 mt-1">
              RBAC &mdash; Contrôle d&rsquo;accès basé sur les rôles conformément au Cahier des Charges
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            {(["list", "matrix"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                  viewMode === mode
                    ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {mode === "list" ? "📋 Liste des rôles" : "🔢 Matrice des permissions"}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="p-10 text-center text-sm text-slate-400 bg-slate-900/70 border border-slate-800 rounded-2xl">
            Chargement des rôles…
          </div>
        )}

        {!loading && error && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start justify-between gap-4">
            <p className="text-sm text-red-300">⚠️ {error}</p>
            <button
              onClick={reload}
              className="flex-shrink-0 px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
              {roles.map((role) => (
                <div key={role.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-center">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleColor(role.slug)} mb-2`}
                  >
                    {role.name}
                  </span>
                  <p className="text-xl font-bold text-white">{role.users_count}</p>
                  <p className="text-[11px] text-slate-500">
                    {role.users_count <= 1 ? "utilisateur" : "utilisateurs"}
                  </p>
                </div>
              ))}
            </div>

            {roles.length === 0 && (
              <p className="text-sm text-slate-400">Aucun rôle n&rsquo;est défini pour cette organisation.</p>
            )}

            {/* ── VIEW: Role List ─────────────────────────── */}
            {viewMode === "list" && (
              <div className="space-y-3">
                {roles.map((role) => {
                  const grantedCount = grantedByRole.get(role.id)?.size ?? 0;
                  const isOpen = expandedRole === role.id;
                  return (
                    <div key={role.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedRole(isOpen ? null : role.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors text-left"
                      >
                        <div className="flex items-center space-x-4 min-w-0">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${roleColor(role.slug)}`}
                          >
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                              Système
                            </span>
                          )}
                          <span className="text-sm text-slate-300 truncate">{role.description}</span>
                        </div>
                        <div className="flex items-center space-x-4 flex-shrink-0">
                          <span className="text-xs text-slate-500">
                            {grantedCount}/{catalog.length} permissions
                          </span>
                          <span className="bg-slate-800 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-700">
                            {role.users_count} 👤
                          </span>
                          <span className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-6 pb-5 border-t border-slate-800">
                          <div className="pt-4 space-y-4">
                            {groupedCatalog.map(([module, perms]) => (
                              <div key={module}>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                  {moduleLabel(module)}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {perms.map((perm) => {
                                    const granted = isGranted(role, perm.slug);
                                    return (
                                      <div
                                        key={perm.slug}
                                        title={perm.slug}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs ${
                                          granted
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "bg-slate-800/40 text-slate-600 border border-slate-800"
                                        }`}
                                      >
                                        <span>{granted ? "✅" : "❌"}</span>
                                        <span>{perm.name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── VIEW: Permission Matrix ─────────────────── */}
            {viewMode === "matrix" && roles.length > 0 && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="px-4 py-3 text-slate-400 font-semibold uppercase tracking-wider sticky left-0 bg-slate-900 min-w-[220px]">
                          Permission
                        </th>
                        {roles.map((role) => (
                          <th key={role.id} className="px-3 py-3 text-center min-w-[120px]">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleColor(role.slug)}`}
                            >
                              {role.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCatalog.map(([module, perms]) => (
                        <React.Fragment key={module}>
                          <tr className="bg-slate-800/30">
                            <td
                              colSpan={roles.length + 1}
                              className="px-4 py-2 text-[11px] font-bold text-sky-400 uppercase tracking-wider"
                            >
                              {moduleLabel(module)}
                            </td>
                          </tr>
                          {perms.map((perm) => (
                            <tr
                              key={perm.slug}
                              className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-slate-300 sticky left-0 bg-slate-900" title={perm.slug}>
                                {perm.name}
                              </td>
                              {roles.map((role) => (
                                <td key={role.id} className="px-3 py-2.5 text-center">
                                  {isGranted(role, perm.slug) ? (
                                    <span className="text-emerald-400 text-sm" aria-label="Accordée">✓</span>
                                  ) : (
                                    <span className="text-slate-700 text-sm" aria-label="Non accordée">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer Note */}
        <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">
            💡 Les rôles et permissions affichés proviennent directement du référentiel RBAC du serveur.
            {canManage
              ? " Vous disposez de la permission de gestion des rôles."
              : " La gestion des rôles requiert la permission « Gérer les rôles et leur attribution »."}
          </p>
        </div>
      </main>
    </div>
  );
}
