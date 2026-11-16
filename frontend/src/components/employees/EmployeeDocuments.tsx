"use client";

import React, { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  GED_ACCEPT,
  GED_CATEGORIES,
  GED_MAX_BYTES,
  gedService,
  type GedCategory,
  type GedDocument,
} from "@/lib/services/gedService";

interface Props {
  employeeId: string;
  canUpload: boolean;
}

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée : reconnectez-vous.";
    if (err.errors) return Object.values(err.errors).flat().join(" ");
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable.";
  return err instanceof Error ? err.message : "Erreur inattendue.";
}

const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1)} Mo`);
const formatDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR");

/** Pièces du dossier RH d'un collaborateur (GED) : liste, téléversement, téléchargement. */
export default function EmployeeDocuments({ employeeId, canUpload }: Props) {
  const [docs, setDocs] = useState<GedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GedCategory>("CNI");
  const [expiration, setExpiration] = useState("");
  const [confidential, setConfidential] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    gedService
      .list(employeeId)
      .then((d) => {
        if (cancelled) return;
        setDocs(d);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, reloadKey]);

  const pickFile = (f: File | null) => {
    setMessage(null);
    if (f && f.size > GED_MAX_BYTES) {
      setError("Fichier trop volumineux (10 Mo maximum).");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setError(null);
    setFile(f);
    if (f && !title) setTitle(GED_CATEGORIES[category]);
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await gedService.upload(employeeId, {
        file,
        title: title.trim(),
        category,
        expiration_date: expiration || undefined,
        is_confidential: confidential,
      });
      setMessage(`« ${title.trim()} » ajouté au dossier.`);
      setFile(null);
      setTitle("");
      setExpiration("");
      if (fileInput.current) fileInput.current.value = "";
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: GedDocument) => {
    if (!window.confirm(`Retirer « ${doc.title} » du dossier ?`)) return;
    setBusy(true);
    try {
      await gedService.remove(doc.id);
      setMessage(`« ${doc.title} » retiré du dossier.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
        <div className="space-y-5">
          {message && <p role="status" className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">✅ {message}</p>}
          {error && <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">⚠️ {error}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Chargement des pièces…</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune pièce dans ce dossier.</p>
          ) : (
            <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {docs.map((d) => (
                <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xl" aria-hidden>
                    {d.mime_type === "application/pdf" ? "📕" : d.mime_type.startsWith("image/") ? "🖼️" : "📄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {d.title}
                      {d.is_confidential && <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400 border border-slate-700 rounded px-1">Confidentiel</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {GED_CATEGORIES[d.category] ?? d.category} &bull; {d.file_name} &bull; {formatSize(d.file_size)}
                      {d.uploaded_by && <> &bull; par {d.uploaded_by}</>}
                    </p>
                    {d.expiration_date && (
                      <p className={`text-xs mt-0.5 ${d.is_expired ? "text-rose-300 font-semibold" : "text-slate-500"}`}>
                        {d.is_expired ? "⚠ Expirée depuis le" : "Expire le"} {formatDate(d.expiration_date)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => gedService.download(d).catch((err) => setError(describe(err)))}
                    className="px-3 py-1.5 text-xs font-medium text-sky-300 border border-sky-500/30 rounded-lg hover:bg-sky-500/10"
                  >
                    Télécharger
                  </button>
                  {canUpload && (
                    <button onClick={() => remove(d)} disabled={busy} aria-label={`Retirer ${d.title}`} className="text-slate-500 hover:text-rose-300 px-1">
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canUpload && (
            <form onSubmit={upload} className="border border-dashed border-slate-700 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white">Ajouter une pièce</h4>
              <input
                ref={fileInput}
                type="file"
                accept={GED_ACCEPT}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-sky-500/15 file:text-sky-300"
                aria-label="Fichier"
              />
              <p className="text-[11px] text-slate-500">PDF, image (JPG, PNG, WebP) ou Word — 10 Mo maximum.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GedCategory)}
                  aria-label="Catégorie"
                  className={inputCls}
                >
                  {(Object.keys(GED_CATEGORIES) as GedCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {GED_CATEGORIES[c]}
                    </option>
                  ))}
                </select>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Intitulé" aria-label="Intitulé" maxLength={255} className={inputCls} />
                <label className="block">
                  <span className="sr-only">Date d&rsquo;expiration</span>
                  <input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} title="Date d'expiration (facultative)" className={inputCls} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
                Confidentiel (visible uniquement par les RH)
              </label>
              <button
                type="submit"
                disabled={busy || !file || !title.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg"
              >
                {busy ? "Envoi…" : "Téléverser"}
              </button>
            </form>
          )}
        </div>
    </div>
  );
}
