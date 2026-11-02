"use client";

import { useEffect, useState } from "react";
import { Employee, PaginatedResponse } from "@/types";
import { api } from "@/services/api";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hire_date: "",
    gender: "M",
    marital_status: "SINGLE",
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      hire_date: new Date().toISOString().split("T")[0],
    }));
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<PaginatedResponse<Employee>>("/employees", {
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setEmployees(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      await api.post("/employees", formData);
      setIsModalOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        hire_date: new Date().toISOString().split("T")[0],
        gender: "M",
        marital_status: "SINGLE",
      });
      fetchEmployees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            N1
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">NTEMO ONE</h1>
            <p className="text-xs text-slate-500">Portail Collaborateurs & Dossiers RH</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
            Organisation : NTEMO Consulting
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Gestion des Employés</h2>
            <p className="text-sm text-slate-500">
              Gérez les dossiers individuels, matricules uniques et affectations au sein de l&apos;organisation.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
          >
            + Nouveau Collaborateur
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, email ou matricule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full md:w-56">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="ON_LEAVE">En congé</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="TERMINATED">Fin de contrat</option>
            </select>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
              <p>Chargement des dossiers employés...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p className="font-semibold">{error}</p>
              <button
                onClick={fetchEmployees}
                className="mt-3 text-sm text-indigo-600 underline font-medium"
              >
                Réessayer
              </button>
            </div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-base font-medium">Aucun collaborateur trouvé.</p>
              <p className="text-sm text-slate-400 mt-1">Créez votre premier dossier employé pour commencer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Matricule</th>
                    <th className="px-6 py-3.5">Collaborateur</th>
                    <th className="px-6 py-3.5">Département & Fonction</th>
                    <th className="px-6 py-3.5">Date Embauche</th>
                    <th className="px-6 py-3.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-indigo-600">
                        {emp.matricule}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{emp.full_name}</div>
                        <div className="text-xs text-slate-400">{emp.email || "Sans email"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800">{emp.position?.title || "Non assigné"}</div>
                        <div className="text-xs text-slate-400">{emp.department?.name || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{emp.hire_date}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            emp.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : emp.status === "ON_LEAVE"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Création Collaborateur */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Nouveau Collaborateur</h3>
            <p className="text-xs text-slate-500 mb-6">
              Le matricule unique (ex: NTM-2026-XXXX) sera automatiquement attribué par le serveur.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email professionnel</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date d&apos;embauche *</label>
                  <input
                    type="date"
                    required
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? "Création..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
