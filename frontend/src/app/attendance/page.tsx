"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";

interface QrSessionData {
  token: string;
  expires_at: string;
  validity_seconds: number;
}

interface CorrectionItem {
  id: string;
  date: string;
  requested_event_type: "IN" | "OUT";
  requested_time: string;
  reason: string;
  status: "PENDING" | "APPROVED_RH" | "REJECTED";
  rejection_reason?: string | null;
  employee: {
    matricule: string;
    first_name: string;
    last_name: string;
    department?: { name: string } | null;
  };
}

export default function AttendanceAdminPage() {
  const [activeTab, setActiveTab] = useState<"kiosk" | "corrections">("kiosk");
  const [deviceIdentifier, setDeviceIdentifier] = useState("KIOSK-ENTREE-01");
  const [qrData, setQrData] = useState<QrSessionData | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Corrections state
  const [corrections, setCorrections] = useState<CorrectionItem[]>([
    {
      id: "corr-1",
      date: "2026-11-02",
      requested_event_type: "IN",
      requested_time: "08:15",
      reason: "Panne temporaire de réseau Wi-Fi à l'entrée des locaux.",
      status: "PENDING",
      employee: {
        matricule: "NTM-2026-003",
        first_name: "Koffi",
        last_name: "Amegan",
        department: { name: "Développement & IT" },
      },
    },
    {
      id: "corr-2",
      date: "2026-11-01",
      requested_event_type: "OUT",
      requested_time: "18:30",
      reason: "Départ d'urgence chez le client Alpha sans possibilité de scanner.",
      status: "APPROVED_RH",
      employee: {
        matricule: "NTM-2026-001",
        first_name: "Jean",
        last_name: "Mavoungou",
        department: { name: "Direction des Opérations" },
      },
    },
  ]);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const refreshQrToken = () => {
    const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase();
    setQrData({
      token: `NTEMO-HMAC-TOKEN-${randomHash}-${Date.now().toString().slice(-4)}`,
      expires_at: new Date(Date.now() + 15000).toISOString(),
      validity_seconds: 15,
    });
    setCountdown(15);
  };

  useEffect(() => {
    refreshQrToken();
  }, []);

  useEffect(() => {
    if (!autoRefresh || activeTab !== "kiosk") return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshQrToken();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, activeTab]);

  const handleApproveCorrection = (id: string) => {
    setCorrections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "APPROVED_RH" as const } : c))
    );
  };

  const handleRejectCorrection = () => {
    if (!selectedCorrection || !rejectionReason.trim()) return;
    setCorrections((prev) =>
      prev.map((c) =>
        c.id === selectedCorrection.id
          ? {
              ...c,
              status: "REJECTED" as const,
              rejection_reason: rejectionReason,
            }
          : c
      )
    );
    setRejectModalOpen(false);
    setSelectedCorrection(null);
    setRejectionReason("");
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⏱️</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Pointage & Gestion des Présences
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Borne dynamique (15s HMAC anti-rejeu) et circuit de régularisation des anomalies (&sect;3.1)
            </p>
          </div>

          {/* Navigation Onglets */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("kiosk")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "kiosk"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Borne QR Dynamique (15s)
            </button>
            <button
              onClick={() => setActiveTab("corrections")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === "corrections"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Régularisations</span>
              {corrections.filter((c) => c.status === "PENDING").length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {activeTab === "kiosk" ? (
          /* Onglet 1 : Borne de pointage */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
                <span className="text-slate-400">Rafraîchissement auto :</span>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
              </div>

              {/* Countdown Circular Ring */}
              <div className="relative mb-6">
                <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-white p-4 shadow-2xl flex flex-col items-center justify-center border-4 border-blue-500/30">
                  {/* QR Graphic Simulation */}
                  <div className="w-full h-full bg-slate-950 rounded-2xl flex flex-col items-center justify-center p-4 relative">
                    {/* SVG QR Code Simulation */}
                    <div className="grid grid-cols-6 gap-2 w-48 h-48 p-2 bg-white rounded-xl">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-sm ${
                            (i % 2 === 0 && (i + countdown) % 3 !== 0) || i === 0 || i === 5 || i === 30
                              ? "bg-slate-950"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded shadow">
                        NTEMO
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-950 border border-blue-500/40 px-4 py-1.5 rounded-full flex items-center space-x-2 shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono font-bold text-white">
                    00:{countdown < 10 ? `0${countdown}` : countdown}s
                  </span>
                </div>
              </div>

              <div className="text-center mt-2">
                <h3 className="text-base font-bold text-white">Scannez pour Pointer</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Pointez votre smartphone via l'application officielle NTEMO ONE. Le jeton HMAC est régénéré automatiquement toutes les 15 secondes.
                </p>
                <div className="mt-3 font-mono text-[11px] text-slate-500 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                  {qrData?.token}
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={refreshQrToken}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center space-x-2"
                >
                  <span>🔄</span>
                  <span>Régénérer Immédiatement</span>
                </button>
              </div>
            </div>

            {/* Sidebar Informations de Borne */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <span>🏢</span>
                  <span>Paramètres du Terminal</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Identifiant Borne</label>
                    <select
                      value={deviceIdentifier}
                      onChange={(e) => setDeviceIdentifier(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="KIOSK-ENTREE-01">KIOSK-ENTREE-01 (Hall Principal)</option>
                      <option value="KIOSK-ETAGE2-02">KIOSK-ETAGE2-02 (Open Space IT)</option>
                      <option value="KIOSK-DIR-03">KIOSK-DIR-03 (Direction Générale)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Protocole de sécurité</span>
                    <span className="text-white font-medium">HMAC-SHA256 &bull; Anti-rejeu strict</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Plage de validité</span>
                    <span className="text-white font-medium">15 secondes chrono</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                  <span>💡</span>
                  <span>Guide Opérationnel</span>
                </h3>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Ce QR Code dynamique ne peut pas être photographié à l'avance.</li>
                  <li>Une capture d'écran partagée sera automatiquement refusée par le serveur.</li>
                  <li>En cas d'incident, le collaborateur peut déposer une régularisation.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Onglet 2 : Régularisations des anomalies */
          <div className="my-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-white">Demandes de Régularisation de Pointage</h2>
                  <p className="text-xs text-slate-400">
                    Examinez les demandes de correction suite à un oubli, panne réseau ou mission extérieure
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {corrections.length} demande(s) enregistrée(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Date & Heure Souhaitée</th>
                      <th className="py-3.5 px-4 font-semibold">Collaborateur</th>
                      <th className="py-3.5 px-4 font-semibold">Type</th>
                      <th className="py-3.5 px-4 font-semibold">Motif Justificatif</th>
                      <th className="py-3.5 px-4 font-semibold">Statut</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Décision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {corrections.map((corr) => (
                      <tr key={corr.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-xs text-white font-semibold">{corr.date}</div>
                          <div className="font-mono text-xs text-blue-400">{corr.requested_time}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white">
                            {corr.employee.first_name} {corr.employee.last_name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {corr.employee.matricule} &bull; {corr.employee.department?.name || "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              corr.requested_event_type === "IN"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-purple-500/20 text-purple-400"
                            }`}
                          >
                            {corr.requested_event_type === "IN" ? "Entrée" : "Sortie"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-xs text-slate-300">
                          <p>{corr.reason}</p>
                          {corr.status === "REJECTED" && corr.rejection_reason && (
                            <p className="mt-1 text-xs text-rose-400 italic">
                              Motif refus : {corr.rejection_reason}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              corr.status === "APPROVED_RH"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : corr.status === "REJECTED"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {corr.status === "APPROVED_RH"
                              ? "Régularisé (RH)"
                              : corr.status === "REJECTED"
                              ? "Rejeté"
                              : "En attente RH"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          {corr.status === "PENDING" ? (
                            <>
                              <button
                                onClick={() => handleApproveCorrection(corr.id)}
                                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCorrection(corr);
                                  setRejectModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/30 transition-colors"
                              >
                                Rejeter
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Traité</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Rejet Régularisation */}
        {rejectModalOpen && selectedCorrection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Rejeter la Régularisation</h3>
              <p className="text-sm text-slate-400 mb-4">
                Collaborateur :{" "}
                <span className="text-white font-medium">
                  {selectedCorrection.employee.first_name} {selectedCorrection.employee.last_name}
                </span>{" "}
                (Pointage du {selectedCorrection.date} à {selectedCorrection.requested_time})
              </p>

              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Motif du rejet (obligatoire) *
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Absence non justifiée par un ordre de mission..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 mb-4"
              />

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRejectCorrection}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
