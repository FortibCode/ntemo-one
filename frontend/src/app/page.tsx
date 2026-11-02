"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Tableau de Bord Exécutif
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 capitalize">
              {currentDate || "Chargement..."} &bull; Bienvenue,{" "}
              <span className="text-blue-400 font-semibold">{user?.name}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/attendance"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-blue-500/20"
            >
              <span>⏱️</span>
              <span>Lancer Borne QR (15s)</span>
            </Link>
            <Link
              href="/documents"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all"
            >
              <span>📄</span>
              <span>Générer un Document</span>
            </Link>
          </div>
        </div>

        {/* Alerte Contrats CDD / Période d'essai (Cahier des charges 3.4) */}
        <div className="my-6 p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 rounded-r-xl border-y border-r border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-sm font-bold text-amber-300">
                Alerte RH : 2 contrats arrivent à échéance sous 15 jours
              </h3>
              <p className="text-xs text-slate-400">
                Koffi AMEGAN (Fin de période d'essai le 15 Nov.) &bull; Sarah KOUKA (Échéance CDD le 20 Nov.)
              </p>
            </div>
          </div>
          <Link
            href="/employees"
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium whitespace-nowrap"
          >
            Examiner les Dossiers &rarr;
          </Link>
        </div>

        {/* KPIs Grid (Cahier des charges 3.5) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* KPI 1 : Présences */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Taux de Présence
              </span>
              <span className="text-lg">⏱️</span>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400">94.2%</div>
            <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1.5">
              <span className="text-emerald-400 font-semibold">+2.1%</span>
              <span>vs semaine précédente</span>
            </div>
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: "94.2%" }} />
            </div>
          </div>

          {/* KPI 2 : Congés en attente */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Congés à Valider
              </span>
              <span className="text-lg">🏖️</span>
            </div>
            <div className="text-3xl font-extrabold text-amber-400">3</div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="text-amber-400 font-semibold">2 N+1</span> &bull; 1 validation finale RH
            </div>
            <Link
              href="/leaves"
              className="mt-3 block text-[11px] text-blue-400 hover:text-blue-300 font-medium"
            >
              Consulter les demandes &rarr;
            </Link>
          </div>

          {/* KPI 3 : Documents générés */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Documents Scellés
              </span>
              <span className="text-lg">📄</span>
            </div>
            <div className="text-3xl font-extrabold text-blue-400">48</div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="text-blue-400 font-semibold">100%</span> avec empreinte SHA-256
            </div>
            <div className="mt-3 text-[11px] text-slate-500 font-mono">
              Word &bull; Excel &bull; PDF
            </div>
          </div>

          {/* KPI 4 : Feuilles de temps */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Heures Projets (Mois)
              </span>
              <span className="text-lg">📈</span>
            </div>
            <div className="text-3xl font-extrabold text-indigo-400">624 h</div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">11.5 h</span> en attente d'approbation
            </div>
            <Link
              href="/timesheets"
              className="mt-3 block text-[11px] text-blue-400 hover:text-blue-300 font-medium"
            >
              Voir imputations &rarr;
            </Link>
          </div>
        </div>

        {/* Section Double Colonne : Activité Récente & Raccourcis Métier */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne Gauche : Derniers Pointages & Flux de Présences */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>⏱️</span>
                <span>Flux des Pointages du Jour (QR 15s)</span>
              </h2>
              <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                &bull; Synchronisation Active
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  name: "Jean Mavoungou",
                  matricule: "NTM-2026-001",
                  dept: "Direction des Opérations",
                  time: "08:02:14",
                  type: "IN",
                  status: "À l'heure",
                  statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                },
                {
                  name: "Awa Ndiaye",
                  matricule: "NTM-2026-002",
                  dept: "Ressources Humaines",
                  time: "08:15:33",
                  type: "IN",
                  status: "À l'heure",
                  statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                },
                {
                  name: "Koffi Amegan",
                  matricule: "NTM-2026-003",
                  dept: "Développement & IT",
                  time: "08:34:50",
                  type: "IN",
                  status: "Retard (+19m)",
                  statusColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                },
                {
                  name: "Sarah Kouka",
                  matricule: "NTM-2026-004",
                  dept: "Consulting & Audit",
                  time: "07:58:02",
                  type: "IN",
                  status: "À l'heure",
                  statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center justify-center">
                      {p.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.dept} &bull; <span className="font-mono text-slate-500">{p.matricule}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs text-slate-300 font-semibold">{p.time}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${p.statusColor}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
              <Link
                href="/attendance"
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Accéder au journal complet des présences &rarr;
              </Link>
            </div>
          </div>

          {/* Colonne Droite : Modules d'Accès Rapide & Sécurité */}
          <div className="space-y-5">
            {/* Badges Numériques */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                <span>🪪</span>
                <span>Contrôle & Badges</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Cartes virtuelles mobiles et badges physiques recto/verso haute résolution prêts à imprimer.
              </p>
              <div className="flex space-x-2">
                <Link
                  href="/badges"
                  className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-all"
                >
                  Gérer les Badges
                </Link>
              </div>
            </div>

            {/* Assistant IA NTEMO */}
            <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-800/40 rounded-2xl p-6">
              <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                <span>🤖</span>
                <span className="text-xs font-bold uppercase tracking-wider">NTEMO AI Assistant</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                Génération Automatisée de Brouillons
              </h4>
              <p className="text-xs text-indigo-200/80 mb-4">
                Rédigez vos contrats, synthèses de réunions et courriers officiels en quelques secondes.
              </p>
              <Link
                href="/ai-assistant"
                className="block text-center py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all"
              >
                Ouvrir l'Assistant IA
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
