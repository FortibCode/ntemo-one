"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  currentPath?: string;
}

const navItems = [
  { label: "Collaborateurs & RH", href: "/", icon: "👥" },
  { label: "Pointage & Présences (15s)", href: "/attendance", icon: "⏱️" },
  { label: "Validation des Congés", href: "/leaves", icon: "🏖️" },
  { label: "Badges Numériques", href: "/badges", icon: "🪪" },
  { label: "Génération Documentaire", href: "/documents", icon: "📄" },
  { label: "Projets & Feuilles de Temps", href: "/timesheets", icon: "📊" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-sm">
          N1
        </div>
        <div>
          <h1 className="text-white font-bold text-base tracking-wide">NTEMO ONE</h1>
          <p className="text-xs text-slate-400">Portail Administration RH</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Modules Métier
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tenant Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/60 rounded-lg p-3">
          <p className="text-xs text-slate-400">Organisation</p>
          <p className="text-sm font-semibold text-white truncate">NTEMO Consulting</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded">
            Tenant Actif
          </span>
        </div>
      </div>
    </aside>
  );
}
