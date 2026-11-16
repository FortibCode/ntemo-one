"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { roleService, type RoleSummary, type RoleUser } from "@/lib/services/roleService";

interface Props {
  roles: RoleSummary[];
  roleColor: (slug: string) => string;
  /** Notifie la page qu'un compteur d'utilisateurs a changé (delta +1 / -1). */
  onCountChange: (roleId: string, delta: number) => void;
}

type Feedback = { kind: "success" | "error"; text: string };

const SEARCH_DEBOUNCE_MS = 300;

export default function RoleAssignmentPanel({ roles, roleColor, onCountChange }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Anti-rebond de la recherche
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    roleService
      .users({ search: debouncedSearch || undefined, role_id: roleFilter || undefined })
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Chargement impossible." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleFilter]);

  const updateUserRoles = (userId: string, update: (current: RoleUser["roles"]) => RoleUser["roles"]) =>
    setUsers((list) => list.map((u) => (u.id === userId ? { ...u, roles: update(u.roles) } : u)));

  const errorText = (err: unknown) =>
    err instanceof ApiError || err instanceof Error ? err.message : "Une erreur inattendue est survenue.";

  const assign = async (user: RoleUser) => {
    const roleId = pendingRole[user.id];
    if (!roleId) return;
    const role = roles.find((r) => r.id === roleId);
    setBusyKey(`${user.id}:add`);
    setFeedback(null);
    try {
      await roleService.assign(user.id, roleId);
      if (role) updateUserRoles(user.id, (current) => [...current, { id: role.id, name: role.name, slug: role.slug }]);
      onCountChange(roleId, 1);
      setPendingRole((p) => ({ ...p, [user.id]: "" }));
      setFeedback({ kind: "success", text: `Rôle « ${role?.name} » attribué à ${user.name}.` });
    } catch (err) {
      setFeedback({ kind: "error", text: errorText(err) });
    } finally {
      setBusyKey(null);
    }
  };

  const revoke = async (user: RoleUser, role: RoleUser["roles"][number]) => {
    if (!window.confirm(`Retirer le rôle « ${role.name} » à ${user.name} ?`)) return;
    setBusyKey(`${user.id}:${role.id}`);
    setFeedback(null);
    try {
      await roleService.revoke(user.id, role.id);
      updateUserRoles(user.id, (current) => current.filter((r) => r.id !== role.id));
      onCountChange(role.id, -1);
      setFeedback({ kind: "success", text: `Rôle « ${role.name} » retiré à ${user.name}.` });
    } catch (err) {
      setFeedback({ kind: "error", text: errorText(err) });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou matricule…"
          aria-label="Rechercher un utilisateur"
          className="flex-1 bg-slate-800/60 text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filtrer par rôle"
          className="md:w-64 bg-slate-800/60 text-sm text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`px-4 py-3 rounded-xl text-sm border ${
            feedback.kind === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
        </div>
      )}

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold">Utilisateur</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Rôles attribués</th>
                <th className="px-4 py-3 font-semibold min-w-[260px]">Ajouter un rôle</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Chargement des utilisateurs…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Aucun utilisateur ne correspond à la recherche.
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) => {
                  const available = roles.filter((r) => !u.roles.some((ur) => ur.id === r.id));
                  return (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 align-top">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">
                          {u.name}
                          {u.is_self && <span className="ml-2 text-[10px] text-sky-400">(vous)</span>}
                          {!u.is_active && <span className="ml-2 text-[10px] text-red-400">désactivé</span>}
                        </p>
                        <p className="text-slate-500">
                          {u.email}
                          {u.matricule && <span className="ml-2 font-mono">{u.matricule}</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.department ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.length === 0 && <span className="text-slate-600">Aucun rôle</span>}
                          {u.roles.map((r) => (
                            <span
                              key={r.id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleColor(r.slug)}`}
                            >
                              {r.name}
                              {!u.is_self && (
                                <button
                                  type="button"
                                  onClick={() => revoke(u, r)}
                                  disabled={busyKey !== null}
                                  aria-label={`Retirer le rôle ${r.name} à ${u.name}`}
                                  className="ml-0.5 opacity-70 hover:opacity-100 disabled:opacity-30"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {available.length === 0 ? (
                          <span className="text-slate-600">Tous les rôles sont attribués</span>
                        ) : (
                          <div className="flex gap-2">
                            <select
                              value={pendingRole[u.id] ?? ""}
                              onChange={(e) => setPendingRole((p) => ({ ...p, [u.id]: e.target.value }))}
                              aria-label={`Rôle à attribuer à ${u.name}`}
                              className="flex-1 bg-slate-800/60 text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            >
                              <option value="">Choisir…</option>
                              {available.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => assign(u)}
                              disabled={!pendingRole[u.id] || busyKey !== null}
                              className="px-3 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-lg"
                            >
                              {busyKey === `${u.id}:add` ? "…" : "Attribuer"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Affiche au plus 100 utilisateurs : affinez la recherche pour les grandes organisations. Vos propres rôles ne
        peuvent pas vous être retirés, afin d&rsquo;éviter de perdre l&rsquo;accès administrateur.
      </p>
    </div>
  );
}
