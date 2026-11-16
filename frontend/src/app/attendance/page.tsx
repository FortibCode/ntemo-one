"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  attendanceService,
  type AttendanceDevice,
  type CorrectionItem,
  type CorrectionStatus,
  type QrSession,
} from "@/lib/services/attendanceService";

const DEVICE_STORAGE_KEY = "ntemo_kiosk_device";
/** Renouvellement 1 s avant l'expiration : le QR affiché n'est jamais périmé. */
const RENEW_MARGIN_MS = 1000;
const ERROR_RETRY_MS = 5000;

function errorMessage(err: unknown, forbiddenHint: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return forbiddenHint;
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.status === 404) return "Borne inconnue pour votre organisation.";
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

function readStoredDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeDevice(identifier: string) {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, identifier);
  } catch {
    /* stockage indisponible : simple confort, sans conséquence */
  }
}

const STATUS_LABELS: Record<CorrectionStatus, string> = {
  PENDING: "En attente",
  APPROVED_N1: "Validé N+1",
  APPROVED_RH: "Régularisé",
  REJECTED: "Rejeté",
};

const STATUS_STYLES: Record<CorrectionStatus, string> = {
  PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  APPROVED_N1: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  APPROVED_RH: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function AttendanceAdminPage() {
  const { user } = useAuth();
  const canKiosk = hasPermission(user, "attendance.scan_device");
  const canReview = hasPermission(user, "attendance.approve_correction");

  const [activeTab, setActiveTab] = useState<"kiosk" | "corrections">("kiosk");

  /* ── Borne QR ──────────────────────────────────────────────── */
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRequest, setQrRequest] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // Initialisée à 0 (pré-rendu serveur) puis synchronisée à chaque réception de QR et par l'intervalle
  const [now, setNow] = useState(0);
  const kioskRef = useRef<HTMLDivElement>(null);

  // Liste des bornes
  useEffect(() => {
    let cancelled = false;
    attendanceService
      .devices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        setDevicesError(list.length === 0 ? "Aucune borne active n'est enregistrée pour votre organisation." : null);
        const stored = readStoredDevice();
        const initial = list.find((d) => d.device_identifier === stored) ?? list[0];
        if (initial) setDeviceId(initial.device_identifier);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDevicesError(
            errorMessage(err, "Ce compte n'est pas autorisé à piloter une borne (permission requise : attendance.scan_device)."),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Récupération d'un QR signé par le serveur
  useEffect(() => {
    if (!deviceId || activeTab !== "kiosk") return;
    let cancelled = false;
    attendanceService
      .qrSession(deviceId)
      .then((session) => {
        if (cancelled) return;
        const receivedTime = Date.now();
        setQr(session);
        setReceivedAt(receivedTime);
        setNow(receivedTime);
        setQrError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQr(null);
        setQrError(errorMessage(err, "Génération de QR refusée pour ce compte."));
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, qrRequest, activeTab]);

  const requestNewQr = useCallback(() => setQrRequest((n) => n + 1), []);

  // Renouvellement automatique avant expiration (ou nouvelle tentative après erreur)
  useEffect(() => {
    if (!autoRefresh || activeTab !== "kiosk" || !deviceId) return;
    const delay = qrError
      ? ERROR_RETRY_MS
      : qr
        ? Math.max(0, qr.validity_seconds * 1000 - (Date.now() - receivedAt) - RENEW_MARGIN_MS)
        : null;
    if (delay === null) return;
    const t = setTimeout(() => {
      // Onglet masqué : inutile de consommer des sessions QR
      if (typeof document !== "undefined" && document.hidden) return;
      requestNewQr();
    }, delay);
    return () => clearTimeout(t);
  }, [autoRefresh, activeTab, deviceId, qr, qrError, receivedAt, requestNewQr]);

  // Reprise immédiate au retour sur l'onglet
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && autoRefresh && activeTab === "kiosk") requestNewQr();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [autoRefresh, activeTab, requestNewQr]);

  // Horloge du compte à rebours
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const validityMs = (qr?.validity_seconds ?? 15) * 1000;
  const elapsedMs = Math.max(0, now - receivedAt);
  const remainingMs = qr ? Math.max(0, validityMs - elapsedMs) : 0;
  const remaining = Math.ceil(remainingMs / 1000);
  const expired = !qr || remainingMs <= 0;
  const progress = qr ? remainingMs / validityMs : 0;

  const selectDevice = (identifier: string) => {
    setDeviceId(identifier);
    storeDevice(identifier);
  };

  const toggleFullscreen = () => {
    const el = kioskRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  /* ── Régularisations ──────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<CorrectionStatus | "">("PENDING");
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(true);
  const [correctionsError, setCorrectionsError] = useState<string | null>(null);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [correctionsRequest, setCorrectionsRequest] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CorrectionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    Promise.all([
      attendanceService.corrections({ status: statusFilter || undefined }),
      attendanceService.corrections({ status: "PENDING" }),
    ])
      .then(([page, pending]) => {
        if (cancelled) return;
        setCorrections(page.data);
        setPendingTotal(pending.total);
        setCorrectionsError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCorrectionsError(
            errorMessage(err, "Vous n'avez pas la permission de traiter les régularisations."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCorrectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canReview, statusFilter, correctionsRequest]);

  const reloadCorrections = () => {
    setCorrectionsLoading(true);
    setCorrectionsRequest((n) => n + 1);
  };

  const review = async (item: CorrectionItem, action: "APPROVE" | "REJECT", reason?: string) => {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const message = await attendanceService.reviewCorrection(item.id, action, reason);
      setFeedback({ kind: "success", text: message || "Demande traitée." });
      setRejectTarget(null);
      setRejectionReason("");
      reloadCorrections();
    } catch (err) {
      setFeedback({ kind: "error", text: errorMessage(err, "Action non autorisée.") });
    } finally {
      setBusyId(null);
    }
  };

  /* ── Rendu ────────────────────────────────────────────────── */
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const currentDevice = devices.find((d) => d.device_identifier === deviceId);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⏱️</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Pointage &amp; Gestion des Présences</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Borne dynamique (15 s, HMAC anti-rejeu) et circuit de régularisation des anomalies (&sect;3.1)
            </p>
          </div>

          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("kiosk")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "kiosk" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Borne QR Dynamique
            </button>
            <button
              onClick={() => setActiveTab("corrections")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === "corrections" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Régularisations</span>
              {pendingTotal > 0 && (
                <span className="min-w-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  {pendingTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "kiosk" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8">
            {/* ── Écran de borne ─────────────────────────── */}
            <div
              ref={kioskRef}
              className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl min-h-[520px]"
            >
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <label className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-full text-xs cursor-pointer">
                  <span className="text-slate-400">Renouvellement auto</span>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                  />
                </label>
                <button
                  onClick={toggleFullscreen}
                  title="Plein écran (tablette d'accueil)"
                  aria-label="Basculer en plein écran"
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-full text-xs text-slate-300"
                >
                  ⛶ Plein écran
                </button>
              </div>

              {devicesError ? (
                <div className="max-w-md text-center">
                  <p className="text-4xl mb-4">🔒</p>
                  <p className="text-sm text-rose-300">{devicesError}</p>
                  {!canKiosk && (
                    <p className="text-xs text-slate-500 mt-3">
                      Connectez la tablette d&rsquo;accueil avec un compte RH ou un compte dédié disposant de la
                      permission « Scanner terminal de pointage ».
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {currentDevice && (
                    <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">{currentDevice.name}</p>
                  )}

                  <div className="relative">
                    <div
                      className={`rounded-3xl bg-white p-5 shadow-2xl border-4 transition-colors ${
                        expired ? "border-slate-600" : "border-blue-500/40"
                      }`}
                    >
                      {qr ? (
                        <QRCodeSVG
                          value={qr.token}
                          size={260}
                          level="M"
                          marginSize={1}
                          title="QR code de pointage NTEMO ONE"
                          className={`transition-opacity ${expired ? "opacity-15" : "opacity-100"}`}
                        />
                      ) : (
                        <div className="w-[260px] h-[260px] flex items-center justify-center text-slate-400 text-sm">
                          {qrError ? "QR indisponible" : "Génération du QR…"}
                        </div>
                      )}
                    </div>

                    {qr && expired && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={requestNewQr}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg"
                        >
                          QR expiré — Générer un nouveau code
                        </button>
                      </div>
                    )}

                    {/* Compte à rebours */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 border border-slate-700 rounded-full p-1 shadow-lg">
                      <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Validité restante : ${remaining} secondes`}>
                        <circle cx="28" cy="28" r={ringRadius} fill="none" stroke="#1e293b" strokeWidth="5" />
                        <circle
                          cx="28"
                          cy="28"
                          r={ringRadius}
                          fill="none"
                          stroke={remaining <= 3 ? "#f59e0b" : "#38bdf8"}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringCircumference * (1 - progress)}
                          transform="rotate(-90 28 28)"
                          style={{ transition: "stroke-dashoffset 250ms linear" }}
                        />
                        <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="monospace">
                          {remaining}
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="text-center mt-12">
                    <h3 className="text-lg font-bold text-white">Scannez pour pointer</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Ouvrez l&rsquo;application NTEMO ONE, onglet « Pointage », puis « Scanner le QR code ». Le code
                      change toutes les {qr?.validity_seconds ?? 15} secondes et ne sert qu&rsquo;une fois.
                    </p>
                    {qrError && <p className="mt-3 text-xs text-rose-300">⚠️ {qrError} Nouvelle tentative automatique…</p>}
                  </div>
                </>
              )}
            </div>

            {/* ── Paramètres de la borne ─────────────────── */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <span>🏢</span>
                  <span>Paramètres du terminal</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <label className="block">
                    <span className="block text-slate-400 mb-1">Borne</span>
                    <select
                      value={deviceId}
                      onChange={(e) => selectDevice(e.target.value)}
                      disabled={devices.length === 0}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      {devices.length === 0 && <option value="">Aucune borne disponible</option>}
                      {devices.map((d) => (
                        <option key={d.id} value={d.device_identifier}>
                          {d.name} ({d.device_identifier})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="text-slate-400 block">Protocole de sécurité</span>
                    <span className="text-white font-medium">HMAC-SHA256 &bull; usage unique (anti-rejeu)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Plage de validité</span>
                    <span className="text-white font-medium">{qr?.validity_seconds ?? 15} secondes</span>
                  </div>
                  <button
                    onClick={requestNewQr}
                    disabled={!deviceId}
                    className="w-full mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-xl border border-slate-700"
                  >
                    🔄 Régénérer maintenant
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                  <span>💡</span>
                  <span>Guide opérationnel</span>
                </h3>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Chaque QR est signé par le serveur et expire au bout de 15 secondes.</li>
                  <li>Un code déjà utilisé ou photographié puis partagé est refusé.</li>
                  <li>Passez la tablette en plein écran pour l&rsquo;accueil.</li>
                  <li>En cas d&rsquo;incident, le collaborateur dépose une régularisation.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* ── Régularisations ─────────────────────────────── */
          <div className="my-8 space-y-4">
            {!canReview ? (
              <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300">
                🔒 Le traitement des régularisations requiert la permission « Approuver régularisation présence ».
              </div>
            ) : (
              <>
                {feedback && (
                  <div
                    role={feedback.kind === "error" ? "alert" : "status"}
                    className={`px-4 py-3 rounded-xl text-sm border ${
                      feedback.kind === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                    <div>
                      <h2 className="text-base font-bold text-white">Demandes de régularisation de pointage</h2>
                      <p className="text-xs text-slate-400">
                        Une demande approuvée crée le pointage manquant et recalcule la journée du collaborateur.
                      </p>
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setCorrectionsLoading(true);
                        setStatusFilter(e.target.value as CorrectionStatus | "");
                      }}
                      aria-label="Filtrer par statut"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="PENDING">En attente</option>
                      <option value="APPROVED_RH">Régularisées</option>
                      <option value="REJECTED">Rejetées</option>
                      <option value="">Toutes</option>
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3.5 px-4 font-semibold">Date &amp; heure demandée</th>
                          <th className="py-3.5 px-4 font-semibold">Collaborateur</th>
                          <th className="py-3.5 px-4 font-semibold">Type</th>
                          <th className="py-3.5 px-4 font-semibold">Motif</th>
                          <th className="py-3.5 px-4 font-semibold">Statut</th>
                          <th className="py-3.5 px-4 font-semibold text-right">Décision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {correctionsLoading && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              Chargement…
                            </td>
                          </tr>
                        )}
                        {!correctionsLoading && correctionsError && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-rose-300">
                              ⚠️ {correctionsError}{" "}
                              <button onClick={reloadCorrections} className="underline ml-2">
                                Réessayer
                              </button>
                            </td>
                          </tr>
                        )}
                        {!correctionsLoading && !correctionsError && corrections.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              Aucune demande pour ce filtre.
                            </td>
                          </tr>
                        )}
                        {!correctionsLoading &&
                          !correctionsError &&
                          corrections.map((corr) => (
                            <tr key={corr.id} className="hover:bg-slate-800/40 transition-colors align-top">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-mono text-xs text-white font-semibold">
                                  {new Date(`${corr.date}T00:00:00`).toLocaleDateString("fr-FR")}
                                </div>
                                <div className="font-mono text-xs text-blue-400">{corr.requested_time}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-medium text-white">{corr.employee.full_name ?? "—"}</div>
                                <div className="text-xs text-slate-400 font-mono">
                                  {corr.employee.matricule ?? "—"} &bull; {corr.employee.department ?? "—"}
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
                                  <p className="mt-1 text-rose-400 italic">Motif du refus : {corr.rejection_reason}</p>
                                )}
                                {corr.reviewer_name && corr.status !== "PENDING" && (
                                  <p className="mt-1 text-slate-500">Traité par {corr.reviewer_name}</p>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[corr.status]}`}
                                >
                                  {STATUS_LABELS[corr.status]}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                                {corr.status === "PENDING" ? (
                                  <>
                                    <button
                                      onClick={() => review(corr, "APPROVE")}
                                      disabled={busyId !== null}
                                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium"
                                    >
                                      {busyId === corr.id ? "…" : "Valider"}
                                    </button>
                                    <button
                                      onClick={() => setRejectTarget(corr)}
                                      disabled={busyId !== null}
                                      className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-300 rounded border border-rose-500/30"
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
              </>
            )}
          </div>
        )}

        {/* Modal de rejet */}
        {rejectTarget && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Rejeter la régularisation</h3>
              <p className="text-sm text-slate-400 mb-4">
                <span className="text-white font-medium">{rejectTarget.employee.full_name}</span> — pointage du{" "}
                {new Date(`${rejectTarget.date}T00:00:00`).toLocaleDateString("fr-FR")} à {rejectTarget.requested_time}
              </p>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Motif du rejet (obligatoire)</span>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex : absence non justifiée par un ordre de mission…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 mb-4"
                />
              </label>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => review(rejectTarget, "REJECT", rejectionReason.trim())}
                  disabled={!rejectionReason.trim() || busyId !== null}
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
