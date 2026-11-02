"use client";

import React, { useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";

interface TimeEntryItem {
  id: string;
  date: string;
  hours: number;
  description: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  employee: {
    matricule: string;
    first_name: string;
    last_name: string;
    department?: { name: string } | null;
  };
  project: {
    id: string;
    name: string;
    code: string;
  };
  task?: {
    id: string;
    name: string;
  } | null;
}

export default function TimesheetsAdminPage() {
  const [entries, setEntries] = useState<TimeEntryItem[]>([
    {
      id: "te-001",
      date: "2026-11-02",
      hours: 7.5,
      description: "Conception de l'architecture backend multi-tenant et tests unitaires.",
      status: "SUBMITTED",
      employee: {
        matricule: "NTM-2026-001",
        first_name: "Jean",
        last_name: "Mavoungou",
        department: { name: "Direction Technique" },
      },
      project: {
        id: "proj-1",
        name: "NTEMO ONE SaaS Core",
        code: "NTM-CORE",
      },
      task: {
        id: "tsk-1",
        name: "Développement API REST v1",
      },
    },
    {
      id: "te-002",
      date: "2026-11-02",
      hours: 4.0,
      description: "Validation des maquettes UI Mobile et corrections du composant de scan QR.",
      status: "SUBMITTED",
      employee: {
        matricule: "NTM-2026-003",
        first_name: "Koffi",
        last_name: "Amegan",
        department: { name: "Développement & IT" },
      },
      project: {
        id: "proj-1",
        name: "NTEMO ONE SaaS Core",
        code: "NTM-CORE",
      },
      task: {
        id: "tsk-2",
        name: "Application Mobile Flutter",
      },
    },
    {
      id: "te-003",
      date: "2026-11-01",
      hours: 8.0,
      description: "Audit des processus RH et paramétrage des règles de calcul de congés.",
      status: "APPROVED",
      employee: {
        matricule: "NTM-2026-002",
        first_name: "Awa",
        last_name: "Ndiaye",
        department: { name: "Ressources Humaines" },
      },
      project: {
        id: "proj-2",
        name: "Refonte SIRH Client Alpha",
        code: "SIRH-ALPHA",
      },
      task: null,
    },
  ]);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Reject Modal state
  const [selectedEntry, setSelectedEntry] = useState<TimeEntryItem | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filteredEntries = entries.filter((e) => {
    const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
    const matchesProject = projectFilter === "ALL" || e.project.code === projectFilter;
    const matchesSearch =
      e.employee.first_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee.last_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee.matricule.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesProject && matchesSearch;
  });

  const handleApprove = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "APPROVED" as const } : e))
    );
  };

  const handleRejectConfirm = () => {
    if (!selectedEntry || !rejectReason.trim()) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === selectedEntry.id
          ? {
              ...e,
              status: "REJECTED" as const,
              rejection_reason: rejectReason,
            }
          : e
      )
    );
    setIsRejectModalOpen(false);
    setSelectedEntry(null);
    setRejectReason("");
  };

  const totalSubmittedHours = entries
    .filter((e) => e.status === "SUBMITTED")
    .reduce((sum, e) => sum + e.hours, 0);

  const totalApprovedHours = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + e.hours, 0);

  const pendingApprovalsCount = entries.filter((e) => e.status === "SUBMITTED").length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Projets & Feuilles de Temps
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Suivi des imputations horaires, vérification d'activité et validation des temps de projet
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Heures En Attente de Validation
            </span>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">
              {totalSubmittedHours} h
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingApprovalsCount} déclaration(s) à examiner
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Heures Approuvées (Mois)
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">
              {totalApprovedHours} h
            </div>
            <p className="text-xs text-slate-500 mt-1">Validées par les chefs de projet</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Projets Actifs Suivis
            </span>
            <div className="text-3xl font-extrabold text-indigo-400 mt-2">2</div>
            <p className="text-xs text-slate-500 mt-1">NTM-CORE, SIRH-ALPHA</p>
          </div>
        </div>

        {/* Tableau des Saisies de Temps */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Rechercher par collaborateur ou descriptif..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-200 placeholder-slate-500 w-full sm:w-72 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="SUBMITTED">En attente (Soumis)</option>
                <option value="APPROVED">Approuvé</option>
                <option value="REJECTED">Rejeté</option>
              </select>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tous les projets</option>
                <option value="NTM-CORE">NTEMO ONE SaaS Core</option>
                <option value="SIRH-ALPHA">Refonte SIRH Client Alpha</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 self-end sm:self-center">
              {filteredEntries.length} ligne(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold">Collaborateur</th>
                  <th className="py-3.5 px-4 font-semibold">Projet & Tâche</th>
                  <th className="py-3.5 px-4 font-semibold">Heures</th>
                  <th className="py-3.5 px-4 font-semibold">Description</th>
                  <th className="py-3.5 px-4 font-semibold">Statut</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Décision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">
                        {entry.employee.first_name} {entry.employee.last_name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {entry.employee.matricule}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-indigo-400 text-xs">
                        {entry.project.code}
                      </div>
                      <div className="text-xs text-slate-300">{entry.project.name}</div>
                      {entry.task && (
                        <div className="text-xs text-slate-500 mt-0.5">↳ {entry.task.name}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 font-bold font-mono text-sm bg-indigo-950/70 text-indigo-300 rounded border border-indigo-800">
                        {entry.hours}h
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-xs text-slate-300">
                      <p className="line-clamp-2">{entry.description}</p>
                      {entry.status === "REJECTED" && entry.rejection_reason && (
                        <p className="mt-1 text-xs text-rose-400 italic">
                          Motif rejet : {entry.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : entry.status === "REJECTED"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {entry.status === "APPROVED"
                          ? "Approuvé"
                          : entry.status === "REJECTED"
                          ? "Rejeté"
                          : "En attente"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      {entry.status === "SUBMITTED" ? (
                        <>
                          <button
                            onClick={() => handleApprove(entry.id)}
                            className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setIsRejectModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/30 transition-colors"
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

        {/* Modal Rejeter Saisie */}
        {isRejectModalOpen && selectedEntry && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Rejeter la Saisie de Temps</h3>
              <p className="text-sm text-slate-400 mb-4">
                Collaborateur :{" "}
                <span className="text-white font-medium">
                  {selectedEntry.employee.first_name} {selectedEntry.employee.last_name}
                </span>{" "}
                ({selectedEntry.hours}h le {selectedEntry.date})
              </p>

              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Motif du rejet (obligatoire) *
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Heures non cohérentes avec le livrable, veuillez préciser..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 mb-4"
              />

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

