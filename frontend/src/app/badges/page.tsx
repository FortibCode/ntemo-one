"use client";

import React, { useState, useEffect } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";

interface BadgeItem {
  id: string;
  badge_number: string;
  security_token: string;
  status: "ACTIVE" | "REVOKED" | "REPLACED" | "EXPIRED";
  issued_at: string;
  expires_at: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  employee: {
    matricule: string;
    first_name: string;
    last_name: string;
    department?: { name: string } | null;
    position?: { title: string } | null;
  };
}

export default function BadgesAdminPage() {
  const [badges, setBadges] = useState<BadgeItem[]>([
    {
      id: "b-001",
      badge_number: "BDG-2026-00412",
      security_token: "NTEMO-SEC-A99F-2026",
      status: "ACTIVE",
      issued_at: "2026-01-15",
      expires_at: "2027-01-15",
      employee: {
        matricule: "NTM-2026-001",
        first_name: "Jean",
        last_name: "Mavoungou",
        department: { name: "Direction Générale" },
        position: { title: "Directeur des Opérations" },
      },
    },
    {
      id: "b-002",
      badge_number: "BDG-2026-00874",
      security_token: "NTEMO-SEC-C41B-2026",
      status: "ACTIVE",
      issued_at: "2026-02-01",
      expires_at: "2027-02-01",
      employee: {
        matricule: "NTM-2026-002",
        first_name: "Awa",
        last_name: "Ndiaye",
        department: { name: "Ressources Humaines" },
        position: { title: "Responsable RH" },
      },
    },
    {
      id: "b-003",
      badge_number: "BDG-2025-00109",
      security_token: "NTEMO-SEC-OLD-8871",
      status: "REVOKED",
      issued_at: "2025-05-10",
      expires_at: "2026-05-10",
      revoked_at: "2026-01-10",
      revocation_reason: "Perte déclarée du smartphone professionnel",
      employee: {
        matricule: "NTM-2026-003",
        first_name: "Koffi",
        last_name: "Amegan",
        department: { name: "Développement & IT" },
        position: { title: "Ingénieur Full-Stack Senior" },
      },
    },
  ]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    status: "idle" | "valid" | "invalid";
    message: string;
    badge?: BadgeItem;
  }>({ status: "idle", message: "" });

  // Issue form state
  const [newMatricule, setNewMatricule] = useState("NTM-2026-004");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newDept, setNewDept] = useState("Consulting & Audit");
  const [newPosition, setNewPosition] = useState("Consultant Senior");

  const filteredBadges = badges.filter((b) => {
    const matchesSearch =
      b.badge_number.toLowerCase().includes(search.toLowerCase()) ||
      b.employee.first_name.toLowerCase().includes(search.toLowerCase()) ||
      b.employee.last_name.toLowerCase().includes(search.toLowerCase()) ||
      b.employee.matricule.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || b.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken.trim()) return;

    const found = badges.find(
      (b) =>
        b.security_token.toLowerCase() === verifyToken.trim().toLowerCase() ||
        b.badge_number.toLowerCase() === verifyToken.trim().toLowerCase()
    );

    if (!found) {
      setVerifyResult({
        status: "invalid",
        message: "Jeton de sécurité inconnu ou invalide.",
      });
    } else if (found.status === "REVOKED") {
      setVerifyResult({
        status: "invalid",
        message: `ALERTE SÉCURITÉ : Badge révoqué ! Motif : ${found.revocation_reason || "Non spécifié"}`,
        badge: found,
      });
    } else {
      setVerifyResult({
        status: "valid",
        message: "Badge actif & authentifié. Accès autorisé.",
        badge: found,
      });
    }
  };

  const handleRevokeConfirm = () => {
    if (!selectedBadge || !revokeReason.trim()) return;
    setBadges((prev) =>
      prev.map((b) =>
        b.id === selectedBadge.id
          ? {
              ...b,
              status: "REVOKED" as const,
              revoked_at: new Date().toISOString().split("T")[0],
              revocation_reason: revokeReason,
            }
          : b
      )
    );
    setIsRevokeModalOpen(false);
    setSelectedBadge(null);
    setRevokeReason("");
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newBadge: BadgeItem = {
      id: `b-${Date.now()}`,
      badge_number: `BDG-2026-${randomSuffix}`,
      security_token: `NTEMO-SEC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-2026`,
      status: "ACTIVE",
      issued_at: new Date().toISOString().split("T")[0],
      expires_at: "2027-01-01",
      employee: {
        matricule: newMatricule,
        first_name: newFirstName,
        last_name: newLastName,
        department: { name: newDept },
        position: { title: newPosition },
      },
    };

    setBadges([newBadge, ...badges]);
    setIsIssueModalOpen(false);
    setNewFirstName("");
    setNewLastName("");
  };

  const activeCount = badges.filter((b) => b.status === "ACTIVE").length;
  const revokedCount = badges.filter((b) => b.status === "REVOKED").length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🪪</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Badges Numériques & Sécurité
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Contrôle d'accès, émission instantanée de cartes virtuelles et vérification de conformité
            </p>
          </div>

          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <span>+</span>
            <span>Émettre un Badge</span>
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Badges Actifs
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">{activeCount}</div>
            <p className="text-xs text-slate-500 mt-1">Accès autorisés sur site et mobile</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Badges Révoqués
            </span>
            <div className="text-3xl font-extrabold text-rose-400 mt-2">{revokedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Perte, vol ou départ de collaborateur</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sécurité Décentralisée
            </span>
            <div className="text-3xl font-extrabold text-indigo-400 mt-2">100%</div>
            <p className="text-xs text-slate-500 mt-1">Jetons signés & Chiffrement asymétrique</p>
          </div>
        </div>

        {/* Scanner de Sécurité Rapide */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-2 flex items-center space-x-2">
            <span>🔍</span>
            <span>Vérificateur de Sécurité (Borne & Accueil)</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Simulez le scan d'un badge physique ou virtuel à l'aide de son identifiant ou jeton de sécurité
          </p>
          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Ex: NTEMO-SEC-A99F-2026 ou BDG-2026-00412"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 px-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700 transition-colors"
            >
              Vérifier le Jeton
            </button>
          </form>

          {verifyResult.status !== "idle" && (
            <div
              className={`mt-4 p-4 rounded-lg border ${
                verifyResult.status === "valid"
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                  : "bg-rose-950/40 border-rose-800 text-rose-200"
              }`}
            >
              <div className="flex items-center space-x-2 font-semibold text-sm">
                <span>{verifyResult.status === "valid" ? "✅" : "🚫"}</span>
                <span>{verifyResult.message}</span>
              </div>
              {verifyResult.badge && (
                <div className="mt-2 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block">Collaborateur</span>
                    <span className="font-medium text-white">
                      {verifyResult.badge.employee.first_name} {verifyResult.badge.employee.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Matricule</span>
                    <span className="font-mono text-white">{verifyResult.badge.employee.matricule}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Département</span>
                    <span className="text-white">{verifyResult.badge.employee.department?.name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Statut Badge</span>
                    <span
                      className={`font-semibold ${
                        verifyResult.badge.status === "ACTIVE" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {verifyResult.badge.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Listing Badges */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Rechercher par nom, matricule ou n° de badge..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-200 placeholder-slate-500 w-full sm:w-80 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="REVOKED">Révoqué</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 self-end sm:self-center">
              {filteredBadges.length} badge(s) répertorié(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">N° Badge</th>
                  <th className="py-3.5 px-4 font-semibold">Collaborateur</th>
                  <th className="py-3.5 px-4 font-semibold">Département & Poste</th>
                  <th className="py-3.5 px-4 font-semibold">Date Émission</th>
                  <th className="py-3.5 px-4 font-semibold">Statut</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredBadges.map((badge) => (
                  <tr key={badge.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-white">
                      {badge.badge_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">
                        {badge.employee.first_name} {badge.employee.last_name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {badge.employee.matricule}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-200">{badge.employee.position?.title || "-"}</div>
                      <div className="text-xs text-slate-400">{badge.employee.department?.name || "-"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      {badge.issued_at}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          badge.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : badge.status === "REVOKED"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {badge.status === "ACTIVE" ? "Actif" : "Révoqué"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {badge.status === "ACTIVE" && (
                        <button
                          onClick={() => {
                            setSelectedBadge(badge);
                            setIsRevokeModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 transition-colors"
                        >
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Révoquer */}
        {isRevokeModalOpen && selectedBadge && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Révoquer le Badge</h3>
              <p className="text-sm text-slate-400 mb-4">
                Êtes-vous sûr de vouloir révoquer le badge{" "}
                <span className="font-mono text-white font-semibold">{selectedBadge.badge_number}</span> de{" "}
                {selectedBadge.employee.first_name} {selectedBadge.employee.last_name} ? Cette action invalidera immédiatement tout accès physique et pointage QR.
              </p>

              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Motif de révocation *
              </label>
              <textarea
                rows={3}
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ex: Perte déclarée du smartphone, fin de contrat de mission..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 mb-4"
              />

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRevokeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRevokeConfirm}
                  disabled={!revokeReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Confirmer la Révocation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Émettre un Badge */}
        {isIssueModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-1">Émettre un Nouveau Badge</h3>
              <p className="text-xs text-slate-400 mb-4">
                Le nouveau badge remplacera tout badge actif précédent pour ce collaborateur.
              </p>

              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Prénom *</label>
                    <input
                      type="text"
                      required
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Prénom"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom *</label>
                    <input
                      type="text"
                      required
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Nom de famille"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Matricule</label>
                    <input
                      type="text"
                      value={newMatricule}
                      onChange={(e) => setNewMatricule(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Département</label>
                    <input
                      type="text"
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Poste occupé</label>
                  <input
                    type="text"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
                  >
                    Générer le Badge
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

