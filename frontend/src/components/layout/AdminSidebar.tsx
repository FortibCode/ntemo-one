"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { hasPermission, useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Tableau de Bord", href: "/", icon: "📊" },
  { label: "Collaborateurs & RH", href: "/employees", icon: "👥" },
  { label: "Pointage & Présences (15s)", href: "/attendance", icon: "⏱️" },
  { label: "Validation des Congés", href: "/leaves", icon: "🏖️" },
  { label: "Badges Numériques", href: "/badges", icon: "🪪" },
  { label: "Moteur Documentaire", href: "/documents", icon: "📄" },
  { label: "Projets & Tâches", href: "/projects", icon: "📈" },
  { label: "Feuilles de Temps", href: "/timesheets", icon: "🕒" },
  { label: "Assistant IA NTEMO AI", href: "/ai-assistant", icon: "🤖" },
];

const adminNavItems = [
  { label: "Rôles & Permissions", href: "/roles", icon: "🔐", permission: "roles.manage" },
  { label: "Paramètres & Système", href: "/settings", icon: "⚙️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen border-r border-slate-800 shadow-xl">
      {/* Brand Header with Official NTÊMO Logo */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/40">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center shadow-md flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Logo NTÊMO"
            width={34}
            height={34}
            className="rounded-lg object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5">
            <h1 className="text-white font-extrabold text-sm tracking-wide truncate">
              NTEMO ONE
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {user?.organizationName || "NTEMO Consulting"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Modules Métier
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-3 px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Administration
        </div>
        {adminNavItems
          .filter((item) => !item.permission || hasPermission(user, item.permission))
          .map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Card & Logout */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/40 space-y-3">
        {user && (
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs">
                {user.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-blue-400 truncate">{user.roleName}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700/40 flex justify-between items-center text-[10px] text-slate-400">
              <span className="font-mono">{user.matricule}</span>
              <span className="text-emerald-400 font-medium">&bull; En ligne</span>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-colors"
        >
          <span>🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
