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
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Soft light ambient background glows in NTÊMO tones */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#e0f2fe]/60 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-[#f0f9ff] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-[#e0f2fe]/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating soft circles on white background */}
      <div className="absolute top-12 left-1/4 w-32 h-32 rounded-full bg-[#0284c7]/[0.03] border border-[#0284c7]/[0.06] pointer-events-none animate-pulse" />
      <div className="absolute bottom-16 right-1/4 w-48 h-48 rounded-full bg-[#0284c7]/[0.03] border border-[#0284c7]/[0.06] pointer-events-none" />

      {/* Main Elevated Modal Card */}
      <div className="w-full max-w-5xl bg-[#0b1e36] rounded-[36px] sm:rounded-[44px] shadow-[0_20px_60px_-10px_rgba(2,132,199,0.22)] border border-slate-200/90 flex flex-col lg:flex-row overflow-hidden relative z-10 min-h-[580px]">
        
        {/* LEFT SECTION (Pure Clean White Canvas with ONLY the Centered NTÊMO Logo) */}
        <div className="relative bg-white text-slate-800 flex flex-col items-center justify-center p-8 sm:p-12 lg:w-[52%] overflow-hidden z-20">
          
          {/* Ambient soft glow behind logo */}
          <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#e0f2fe] via-[#f0f9ff] to-[#e0f2fe]/40 blur-2xl -z-10" />

          {/* Centered Large Official NTÊMO Logo */}
          <div className="relative flex flex-col items-center justify-center">
            <Image
              src="/logo-transparent.png"
              alt="Logo NTÊMO"
              width={260}
              height={260}
              priority
              className="object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105"
            />
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
        <div className="relative bg-[#0c1e34] p-8 sm:p-12 lg:p-14 lg:w-[48%] flex flex-col justify-between overflow-hidden">
          
          {/* Decorative glowing circles in the dark section */}
          <div className="absolute top-10 right-10 w-44 h-44 rounded-full bg-[#0284c7]/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 left-6 w-36 h-36 rounded-full bg-[#38bdf8]/10 blur-xl pointer-events-none" />

          {/* Clean "Login" Header without the extra small logo box */}
          <div className="relative z-10 mb-4 pt-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Login
            </h1>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="relative z-10 mb-4 p-3 bg-rose-950/70 border border-rose-700/80 rounded-2xl text-rose-200 text-xs flex items-center space-x-2 shadow-lg">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields in Capsule / Pill Design matching the reference image */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5 my-auto">
            {/* Username / E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-2">
                Username
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-[#071526]/90 border border-slate-700/80 focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 rounded-full px-5 py-3.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
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
                  className="w-full bg-[#071526]/90 border border-slate-700/80 focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 rounded-full px-5 py-3.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                />
              </div>
              <div className="flex justify-end mt-2 mr-2">
                <span className="text-xs text-[#38bdf8] hover:text-[#7dd3fc] cursor-pointer transition-colors">
                  Forgot Password?
                </span>
              </div>
            </div>

            {/* Main Action Pill Button with NTÊMO Blue Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-[#0284c7] via-[#0284c7] to-[#0369a1] hover:from-[#38bdf8] hover:to-[#0284c7] text-white font-bold py-3.5 rounded-full text-sm shadow-[0_10px_25px_rgba(2,132,199,0.35)] hover:shadow-[0_12px_30px_rgba(56,189,248,0.45)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Clean Minimal Footer matching reference image */}
          <div className="relative z-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="hover:text-slate-200 cursor-pointer">Terms and Services</span>
            <span className="text-[10px] text-slate-400">
              Have a problem? Contact us at{" "}
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
