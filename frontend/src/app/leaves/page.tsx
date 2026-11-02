"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { api } from "@/services/api";

interface LeaveRequestItem {
  id: string;
  leave_type: { name: string };
  employee: { matricule: string; full_name: string };
  start_date: string;
  end_date: string;
  total_days: string | number;
  reason: string;
  status: string;
}

export default function LeavesAdminPage() {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: LeaveRequestItem[] }>("/leaves/my-requests");
      setRequests(res.data || []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReviewN1 = async (id: string, approved: boolean) => {
    try {
      await api.post(`/leaves/requests/${id}/review-n1`, {
        approved,
        comments: approved ? "Validé par manager N+1" : "Rejeté",
      });
      fetchRequests();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleReviewHr = async (id: string, approved: boolean) => {
    try {
      await api.post(`/leaves/requests/${id}/review-hr`, {
        approved,
        comments: approved ? "Validation finale RH" : "Rejet RH",
      });
      fetchRequests();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <h2 className="text-xl font-bold text-slate-900">Validation des Congés & Permissions</h2>
          <p className="text-xs text-slate-500">Circuit hiérarchique à deux niveaux (Manager N+1 &rarr; Direction RH)</p>
        </header>

        <main className="p-8 flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Chargement des demandes...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <p className="text-base font-medium">Aucune demande en attente de traitement.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Collaborateur</th>
                    <th className="px-6 py-3.5">Type & Période</th>
                    <th className="px-6 py-3.5">Durée</th>
                    <th className="px-6 py-3.5">Statut</th>
                    <th className="px-6 py-3.5 text-right">Actions N+1 / RH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{r.employee?.full_name || "Employé"}</div>
                        <div className="text-xs text-slate-400 font-mono">{r.employee?.matricule}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{r.leave_type?.name}</div>
                        <div className="text-xs text-slate-500">Du {r.start_date} au {r.end_date}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{r.total_days} j</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          r.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {r.status === 'PENDING_N1' && (
                          <>
                            <button
                              onClick={() => handleReviewN1(r.id, true)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                            >
                              Approuver N+1
                            </button>
                            <button
                              onClick={() => handleReviewN1(r.id, false)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                            >
                              Rejeter N+1
                            </button>
                          </>
                        )}
                        {r.status === 'PENDING_HR' && (
                          <>
                            <button
                              onClick={() => handleReviewHr(r.id, true)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                            >
                              Validation RH
                            </button>
                            <button
                              onClick={() => handleReviewHr(r.id, false)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                            >
                              Rejet RH
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
