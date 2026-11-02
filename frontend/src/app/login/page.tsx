"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth, DEMO_ACCOUNTS } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, quickLoginAs } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.message || "Identifiants invalides.");
      }
    } catch {
      setError("Une erreur est survenue lors de la tentative de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial gradient accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand / Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md mb-4">
            <Image
              src="/logo.png"
              alt="Logo NTÊMO Consulting"
              width={80}
              height={80}
              priority
              className="rounded-xl object-contain drop-shadow"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center space-x-2">
            <span>NTEMO ONE</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
              v1.0
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Plateforme Intégrée RH, Présences par QR Code, Badges & Moteur Documentaire
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Connexion Administrateur</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Accédez à votre espace de gestion sécurisé (RBAC)
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                E-mail ou Identifiant
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: direction@ntemo.com"
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mot de passe
                </label>
                <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                  Mot de passe oublié ?
                </span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="ml-2 text-xs text-slate-400">
                Se souvenir de moi sur ce poste
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Se connecter au Portail</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Login Profiles according to Cahier des Charges */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Accès Démonstration Rapide (Rôles RBAC)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickLoginAs("direction")}
                className="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-xl text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-blue-400 flex items-center space-x-1">
                  <span>👔</span>
                  <span className="truncate">Direction Générale</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">Glade NTOLANY</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("rh")}
                className="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-emerald-400 flex items-center space-x-1">
                  <span>👥</span>
                  <span className="truncate">Ressources Humaines</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">Awa NDIAYE</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("manager")}
                className="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-amber-400 flex items-center space-x-1">
                  <span>📋</span>
                  <span className="truncate">Chef de Projet / N+1</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">Jean MAVOUNGOU</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("super_admin")}
                className="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-xl text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-purple-400 flex items-center space-x-1">
                  <span>👑</span>
                  <span className="truncate">Super Admin</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">Sécurité & Audit</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          &copy; 2026 NTEMO Consulting &bull; Organisation Multi-tenant Sécurisée
        </p>
      </div>
    </div>
  );
}
