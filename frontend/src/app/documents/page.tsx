"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { api } from "@/services/api";

interface DocTemplate {
  id: string;
  title: string;
  code: string;
  output_format: string;
}

export default function DocumentsAdminPage() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ data: DocTemplate[] }>("/documents/templates");
        setTemplates(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedTemplateId(res.data[0].id);
        }
      } catch (e: unknown) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      setResultMessage(null);
      const res = await api.post<{ success: boolean; data: { id: string; file_hash_sha256: string } }>(
        "/documents/generate",
        {
          template_id: selectedTemplateId,
          employee_id: employeeId || undefined,
        }
      );
      setResultMessage(`Document généré avec succès ! Empreinte SHA-256 : ${res.data.file_hash_sha256}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <h2 className="text-xl font-bold text-slate-900">Moteur de Génération Documentaire</h2>
          <p className="text-xs text-slate-500">Fusion de variables, versions immuables et scellement d&apos;intégrité SHA-256</p>
        </header>

        <main className="p-8 flex-1 max-w-4xl">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Générer une pièce administrative</h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modèle documentaire</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.output_format})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ID du Collaborateur concerné (optionnel)</label>
                <input
                  type="text"
                  placeholder="UUID de l'employé..."
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={generating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
              >
                {generating ? "Génération & Fusion..." : "Générer le Document Officiel"}
              </button>
            </form>

            {resultMessage && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-mono break-all">
                {resultMessage}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

