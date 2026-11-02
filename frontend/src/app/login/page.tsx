"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-[#0a2544] via-[#081c35] to-[#040e1c] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Ambient background glows in NTÊMO logo blue tones */}
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-[#0284c7]/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-[480px] h-[480px] bg-[#0c4884]/35 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] bg-[#38bdf8]/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Floating soft bokeh orbs */}
      <div className="absolute top-12 left-1/4 w-32 h-32 rounded-full bg-white/[0.03] pointer-events-none animate-pulse" />
      <div className="absolute bottom-16 right-1/4 w-48 h-48 rounded-full bg-white/[0.03] pointer-events-none" />

      {/* Main Elevated Modal Card (Border-free, clean elevation) */}
      <div className="w-full max-w-5xl bg-[#091a2e] rounded-[36px] sm:rounded-[44px] shadow-[0_25px_80px_rgba(2,132,199,0.32)] flex flex-col lg:flex-row overflow-hidden relative z-10 min-h-[580px] border-none">
        
        {/* LEFT SECTION (Pure White Canvas with Centered NTÊMO Logo & Organic Wave) */}
        <div className="relative bg-white text-slate-800 flex flex-col items-center justify-center p-8 sm:p-12 lg:w-[50%] z-20">
          
          {/* Centered Large Crisp Official NTÊMO Logo */}
          <div className="relative flex items-center justify-center">
            <Image
              src="/logo-hd.png"
              alt="Logo NTÊMO"
              width={280}
              height={280}
              priority
              className="object-contain select-none"
            />
          </div>

          {/* Organic Wave / Droplet Separator extending into the Dark Right Panel */}
          <div className="hidden lg:block absolute top-0 bottom-0 right-0 translate-x-[99%] w-24 sm:w-28 h-full pointer-events-none z-30">
            <svg
              className="h-full w-full fill-white"
              viewBox="0 0 100 400"
              preserveAspectRatio="none"
            >
              <path d="M 0,0 C 70,40 100,110 55,200 C 15,280 80,350 0,400 Z" />
            </svg>
          </div>
        </div>

        {/* RIGHT SECTION (Dark High-Tech Enterprise Login Form in NTÊMO Blues) */}
        <div className="relative bg-[#091a2e] p-8 sm:p-12 lg:p-14 lg:w-[50%] flex flex-col justify-between overflow-hidden">
          
          {/* Decorative glowing circles in the dark section */}
          <div className="absolute top-10 right-10 w-44 h-44 rounded-full bg-[#0284c7]/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 left-6 w-36 h-36 rounded-full bg-[#38bdf8]/10 blur-xl pointer-events-none" />

          {/* Centered "Connexion" Title */}
          <div className="relative z-10 mb-2 pt-2 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Connexion
            </h1>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="relative z-10 mb-4 p-3 bg-rose-950/80 rounded-2xl text-rose-200 text-xs flex items-center space-x-2 shadow-lg">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields in French without borders (clean, sleek capsule inputs) */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6 my-auto">
            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2 ml-3">
                E-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Entrez votre adresse e-mail"
                  className="w-full bg-[#061424] border-0 border-none outline-none focus:outline-none focus:ring-0 rounded-full px-6 py-4 text-sm text-slate-100 placeholder-slate-500 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2 ml-3">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  className="w-full bg-[#061424] border-0 border-none outline-none focus:outline-none focus:ring-0 rounded-full px-6 py-4 text-sm text-slate-100 placeholder-slate-500 transition-all shadow-inner"
                />
              </div>
              <div className="flex justify-end mt-2 mr-3">
                <span className="text-xs text-[#38bdf8] hover:text-[#7dd3fc] cursor-pointer transition-colors">
                  Mot de passe oublié ?
                </span>
              </div>
            </div>

            {/* Main Action Pill Button with NTÊMO Blue Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#0284c7] via-[#0284c7] to-[#0369a1] hover:from-[#38bdf8] hover:to-[#0284c7] text-white font-bold py-4 rounded-full text-sm shadow-[0_10px_25px_rgba(2,132,199,0.35)] hover:shadow-[0_12px_30px_rgba(56,189,248,0.45)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99] border-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Clean Minimal French Footer matching the reference image */}
          <div className="relative z-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="hover:text-slate-200 cursor-pointer">Conditions d'utilisation</span>
            <span className="text-[10px] text-slate-400">
              Besoin d'aide ? Contactez-nous à{" "}
              <a href="mailto:contact@ntemoconsulting.com" className="text-[#38bdf8] hover:underline">
                contact@ntemoconsulting.com
              </a>
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
