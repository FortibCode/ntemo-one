"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth, DEMO_ACCOUNTS } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, quickLoginAs } = useAuth();
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Soft light ambient background glows in NTÊMO tones */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#e0f2fe]/60 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-[#f0f9ff] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-[#e0f2fe]/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating soft circles on white background */}
      <div className="absolute top-12 left-1/4 w-32 h-32 rounded-full bg-[#0284c7]/[0.03] border border-[#0284c7]/[0.06] pointer-events-none animate-pulse" />
      <div className="absolute bottom-16 right-1/4 w-48 h-48 rounded-full bg-[#0284c7]/[0.03] border border-[#0284c7]/[0.06] pointer-events-none" />

      {/* Main Elevated Modal Card */}
      <div className="w-full max-w-5xl bg-[#0b1e36] rounded-[36px] sm:rounded-[44px] shadow-[0_20px_60px_-10px_rgba(2,132,199,0.22)] border border-slate-200/90 flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* LEFT SECTION (Pure White Canvas with NTÊMO Branding & December 2026 Illustration) */}
        <div className="relative bg-white text-slate-800 flex flex-col justify-between p-8 sm:p-12 lg:w-[52%] overflow-hidden z-20">
          
          {/* Top Brand Header */}
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <span className="block text-sm font-black tracking-wider text-[#0c4884] uppercase font-sans">
                NTÊMO CONSULTING
              </span>
              <span className="block text-[11px] font-bold tracking-widest text-[#0ea5e9] uppercase">
                Plateforme NTEMO ONE &bull; v1.0
              </span>
            </div>
          </div>

          {/* Center Brand Hero: Prominent Official NTÊMO Logo */}
          <div className="relative my-auto py-10 flex flex-col items-center justify-center z-10">
            {/* Soft decorative aura matching logo gradient */}
            <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#e0f2fe] via-[#f0f9ff] to-[#e0f2fe]/40 blur-2xl -z-10" />
            <div className="absolute -top-6 right-8 w-20 h-20 rounded-full bg-[#bae6fd]/30 blur-xl -z-10" />

            <div className="relative flex flex-col items-center justify-center">
              <div className="p-4 rounded-3xl bg-white/60 backdrop-blur-sm border border-slate-100 shadow-sm transition-transform duration-300 hover:scale-105">
                <Image
                  src="/logo-transparent.png"
                  alt="Logo NTÊMO Consulting"
                  width={220}
                  height={220}
                  priority
                  className="object-contain drop-shadow-md"
                />
              </div>

              <div className="mt-6 text-center">
                <h2 className="text-2xl font-black tracking-tight text-[#0c4884]">
                  NTEMO ONE
                </h2>
                <p className="text-xs font-semibold text-[#0ea5e9] tracking-wider uppercase mt-1">
                  Plateforme Intégrée RH & Administration
                </p>
                <div className="mt-3.5 inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20 uppercase tracking-wide">
                  <span>✦</span>
                  <span>Cadeau Numérique Décembre 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Left Footer Info */}
          <div className="relative z-10 text-[11px] text-slate-500 font-medium">
            <p>&copy; 2026 NTEMO Consulting &bull; Brazzaville</p>
            <p className="text-[10px] text-slate-400">Plateforme intégrée sécurisée NTEMO ONE</p>
          </div>

          {/* Organic Wave / Droplet Separator seamlessly connecting into Dark Right Panel */}
          <div className="hidden lg:block absolute -top-1 -bottom-1 -right-16 w-32 pointer-events-none z-10">
            <svg
              className="h-full w-full fill-white"
              viewBox="0 0 100 400"
              preserveAspectRatio="none"
            >
              <path d="M 0,0 C 70,50 95,150 40,240 C 0,300 70,360 0,400 Z" />
            </svg>
          </div>
        </div>

        {/* RIGHT SECTION (Dark High-Tech Enterprise Login Form in NTÊMO Blues) */}
        <div className="relative bg-[#0c1e34] p-8 sm:p-12 lg:w-[48%] flex flex-col justify-between overflow-hidden">
          
          {/* Decorative glowing circles in the dark section */}
          <div className="absolute top-10 right-10 w-44 h-44 rounded-full bg-[#0284c7]/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 left-6 w-36 h-36 rounded-full bg-[#38bdf8]/10 blur-xl pointer-events-none" />

          {/* Form Header with Organic NTÊMO Logo Integration */}
          <div className="relative z-10 mb-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0284c7]/30 to-[#38bdf8]/15 border border-[#38bdf8]/40 flex items-center justify-center p-1.5 shadow-lg shadow-[#0284c7]/20">
                <Image
                  src="/logo-transparent.png"
                  alt="NTÊMO"
                  width={32}
                  height={32}
                  className="object-contain drop-shadow"
                />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Login
                </h1>
                <p className="text-xs text-slate-300">
                  Portail d'Administration Centralisée
                </p>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="relative z-10 mb-4 p-3 bg-rose-950/70 border border-rose-700/80 rounded-2xl text-rose-200 text-xs flex items-center space-x-2 shadow-lg">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* The Form Fields in Capsule / Pill Design matching the image */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            {/* Username / E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-2">
                Username / E-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your username or email"
                  className="w-full bg-[#071526]/90 border border-slate-700/80 focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 rounded-full px-5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#071526]/90 border border-slate-700/80 focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 rounded-full px-5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                />
              </div>
              <div className="flex justify-end mt-1.5 mr-2">
                <span className="text-xs text-[#38bdf8] hover:text-[#7dd3fc] cursor-pointer transition-colors">
                  Forgot Password?
                </span>
              </div>
            </div>

            {/* Main Action Pill Button with NTÊMO Blue Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#0284c7] via-[#0284c7] to-[#0369a1] hover:from-[#38bdf8] hover:to-[#0284c7] text-white font-bold py-3.5 rounded-full text-sm shadow-[0_10px_25px_rgba(2,132,199,0.35)] hover:shadow-[0_12px_30px_rgba(56,189,248,0.45)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Connexion à NTEMO ONE</span>
              )}
            </button>
          </form>

          {/* Quick Demo Selector Integrated organically without cluttering */}
          <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
              Accès Démonstration Rapide (Rôles &sect;4)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickLoginAs("direction")}
                className="p-2 bg-[#071526]/80 hover:bg-[#071526] border border-slate-700/70 hover:border-[#38bdf8]/60 rounded-2xl text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-[#38bdf8] truncate flex items-center space-x-1">
                  <span>👔</span>
                  <span className="truncate">Direction Générale</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Glade NTOLANY</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("rh")}
                className="p-2 bg-[#071526]/80 hover:bg-[#071526] border border-slate-700/70 hover:border-emerald-400/60 rounded-2xl text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-emerald-400 truncate flex items-center space-x-1">
                  <span>👥</span>
                  <span className="truncate">Ressources Humaines</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Awa NDIAYE</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("manager")}
                className="p-2 bg-[#071526]/80 hover:bg-[#071526] border border-slate-700/70 hover:border-amber-400/60 rounded-2xl text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-amber-400 truncate flex items-center space-x-1">
                  <span>📋</span>
                  <span className="truncate">Chef de Projet / N+1</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Jean MAVOUNGOU</div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAs("super_admin")}
                className="p-2 bg-[#071526]/80 hover:bg-[#071526] border border-slate-700/70 hover:border-purple-400/60 rounded-2xl text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-purple-400 truncate flex items-center space-x-1">
                  <span>👑</span>
                  <span className="truncate">Super Admin</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Sécurité & Audit</div>
              </button>
            </div>
          </div>

          {/* Right Bottom Footer Links matching the reference */}
          <div className="relative z-10 mt-6 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="hover:text-slate-200 cursor-pointer">Terms and Services</span>
            <span className="text-[10px] text-slate-400">
              Assistance :{" "}
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
