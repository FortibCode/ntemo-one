"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { api } from "@/services/api";

interface QrSessionData {
  token: string;
  expires_at: string;
  validity_seconds: number;
}

export default function AttendanceAdminPage() {
  const [deviceIdentifier, setDeviceIdentifier] = useState("KIOSK-ENTREE-01");
  const [qrData, setQrData] = useState<QrSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchNewQr = async () => {
    try {
      setLoading(true);
      const res = await api.post<{ success: boolean; data: QrSessionData }>("/attendance/qr-session", {
        device_identifier: deviceIdentifier,
      });
      setQrData(res.data);
      setCountdown(res.data.validity_seconds || 15);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewQr();
  }, [deviceIdentifier]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchNewQr();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, deviceIdentifier]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Borne de Pointage QR Dynamique</h2>
            <p className="text-xs text-slate-500">Génération sécurisée avec validité stricte de 15 secondes</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-600">Actualisation auto :</span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
          </div>
        </header>

        <main className="p-8 flex-1 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-full text-xs mb-4">
              Borne : {deviceIdentifier}
            </div>

            {/* Compteur 15s */}
            <div className="relative w-36 h-36 mx-auto mb-6 flex items-center justify-center">
              <div className="text-4xl font-extrabold text-indigo-600 font-mono">
                {countdown}s
              </div>
            </div>

            {/* QR Token Container */}
            <div className="bg-slate-900 p-6 rounded-2xl text-white mb-6">
              <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Jeton de session signé HMAC</div>
              <div className="font-mono text-xs break-all text-slate-200 bg-slate-800 p-3 rounded-lg border border-slate-700">
                {loading ? "Génération en cours..." : qrData?.token || "Aucun jeton"}
              </div>
            </div>

            <button
              onClick={fetchNewQr}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? "Rafraîchissement..." : "Régénérer immédiatement"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
