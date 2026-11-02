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
    <div className="min-h-screen bg-[#061224] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Ambient background bokeh orbs matching NTÊMO blue palette */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#0284c7]/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-[#0369a1]/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-[#38bdf8]/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating bokeh particles */}
      <div className="absolute top-12 left-1/4 w-32 h-32 rounded-full bg-white/[0.02] border border-white/[0.04] pointer-events-none animate-pulse" />
      <div className="absolute bottom-16 right-1/4 w-48 h-48 rounded-full bg-white/[0.02] border border-white/[0.04] pointer-events-none" />

      {/* Main Elevated Modal Card */}
      <div className="w-full max-w-5xl bg-[#0b1e36] rounded-[36px] sm:rounded-[44px] shadow-[0_25px_70px_rgba(2,132,199,0.18)] border border-slate-700/50 flex flex-col lg:flex-row overflow-hidden relative z-10 backdrop-blur-xl">
        
        {/* LEFT SECTION (Light Canvas with NTÊMO Branding & December 2026 Illustration) */}
        <div className="relative bg-[#f8fafc] text-slate-800 flex flex-col justify-between p-8 sm:p-12 lg:w-[52%] overflow-hidden z-20">
          
          {/* Top Brand Header with NTÊMO Logo */}
          <div className="relative z-10 flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/80 flex items-center justify-center">
              <Image
                src="/logo-transparent.png"
                alt="Logo NTÊMO"
                width={42}
                height={42}
                priority
                className="object-contain"
              />
            </div>
            <div>
              <span className="block text-sm font-black tracking-wider text-[#0c4884] uppercase font-sans">
                NTÊMO CONSULTING
              </span>
              <span className="block text-[11px] font-bold tracking-widest text-[#0ea5e9] uppercase">
                Plateforme NTEMO ONE &bull; v1.0
              </span>
            </div>
          </div>

          {/* Center Illustration : Festive Corporate December 2026 (Cadeau Numérique) */}
          <div className="relative my-8 py-4 flex flex-col items-center justify-center z-10">
            {/* Soft decorative background circles */}
            <div className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-[#e0f2fe] to-[#f0fdf4] -z-10 blur-sm opacity-80" />
            <div className="absolute -top-4 right-12 w-16 h-16 rounded-full bg-[#bae6fd]/40 blur-xs -z-10" />
            <div className="absolute bottom-6 left-10 w-20 h-20 rounded-full bg-[#e2e8f0]/60 blur-xs -z-10" />

            {/* High-fidelity Vector Art */}
            <svg
              className="w-56 h-56 sm:w-64 sm:h-64 drop-shadow-md"
              viewBox="0 0 320 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Ground & Snow layer */}
              <ellipse cx="160" cy="275" rx="110" ry="22" fill="#e2e8f0" />
              <ellipse cx="160" cy="273" rx="95" ry="16" fill="#f1f5f9" />

              {/* Tree Trunk */}
              <rect x="150" y="225" width="20" height="42" rx="4" fill="#334155" />

              {/* Christmas / Innovation Tree Layers in NTÊMO Colors */}
              {/* Bottom Tier */}
              <path
                d="M80 235 C90 205, 120 195, 130 190 L190 190 C200 195, 230 205, 240 235 C220 248, 190 245, 160 245 C130 245, 100 248, 80 235 Z"
                fill="#0f766e"
              />
              <path
                d="M86 230 C120 242, 200 242, 234 230 C220 238, 180 241, 160 241 C140 241, 100 238, 86 230 Z"
                fill="#f8fafc"
                opacity="0.85"
              />

              {/* Middle Tier */}
              <path
                d="M100 190 C110 165, 130 155, 140 150 L180 150 C190 155, 210 165, 220 190 C205 200, 180 198, 160 198 C140 198, 115 200, 100 190 Z"
                fill="#0d9488"
              />
              <path
                d="M106 186 C135 195, 185 195, 214 186 C200 192, 175 194, 160 194 C145 194, 120 192, 106 186 Z"
                fill="#f8fafc"
                opacity="0.85"
              />

              {/* Top Tier */}
              <path
                d="M120 150 C130 125, 145 110, 160 95 C175 110, 190 125, 200 150 C185 158, 170 157, 160 157 C150 157, 135 158, 120 150 Z"
                fill="#14b8a6"
              />
              <path
                d="M126 146 C145 153, 175 153, 194 146 C180 151, 170 152, 160 152 C150 152, 140 151, 126 146 Z"
                fill="#f8fafc"
                opacity="0.85"
              />

              {/* Tree Peak Glowing Star */}
              <polygon
                points="160,82 164,92 174,93 166,100 168,110 160,104 152,110 154,100 146,93 156,92"
                fill="#fbbf24"
              />

              {/* Baubles / Digital Ornaments in NTÊMO Blue & Rose Accent */}
              <circle cx="130" cy="215" r="5" fill="#f43f5e" />
              <circle cx="160" cy="225" r="5" fill="#0284c7" />
              <circle cx="190" cy="215" r="5" fill="#fbbf24" />
              <circle cx="145" cy="175" r="4.5" fill="#38bdf8" />
              <circle cx="175" cy="175" r="4.5" fill="#f43f5e" />
              <circle cx="160" cy="130" r="4" fill="#fbbf24" />

              {/* Characters / Holiday Figures */}
              {/* Little girl decorating */}
              <circle cx="120" cy="220" r="6" fill="#3b0764" />
              <path d="M116 226 L124 226 L127 248 L113 248 Z" fill="#7c3aed" />
              <rect x="115" y="248" width="3" height="12" fill="#1e1b4b" />
              <rect x="122" y="248" width="3" height="12" fill="#1e1b4b" />

              {/* Gift Box with ribbon */}
              <rect x="220" y="240" width="24" height="22" rx="3" fill="#0284c7" />
              <rect x="230" y="240" width="4" height="22" fill="#fbbf24" />
              <rect x="220" y="249" width="24" height="4" fill="#fbbf24" />

              {/* Walking Character on bottom left */}
              <circle cx="56" cy="242" r="5" fill="#0f172a" />
              <path d="M52 247 L60 247 L64 268 L48 268 Z" fill="#1e293b" />
              <line x1="53" y1="268" x2="50" y2="282" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
              <line x1="60" y1="268" x2="64" y2="282" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />

              {/* Decorative small tree next to character */}
              <path d="M68 280 C68 260 84 250 84 250 C84 250 100 260 100 280 Z" fill="#0f766e" />
            </svg>

            <div className="mt-3 text-center">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20 uppercase tracking-wider">
                Cadeau Numérique Décembre 2026
              </span>
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
              className="h-full w-full fill-[#f8fafc]"
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
