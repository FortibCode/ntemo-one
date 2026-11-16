"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import LeaveCalendar from "@/components/leaves/LeaveCalendar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  leaveService,
  type CalendarLeave,
  type LeaveStatus,
  type LeaveType,
  type MyLeaveRequest,
  type PendingLeave,
} from "@/lib/services/leaveService";

type Tab = "mine" | "review" | "calendar";
type Feedback = { kind: "success" | "error"; text: string };

const STATUS: Record<LeaveStatus, { label: string; cls: string }> = {
  PENDING_N1: { label: "En attente N+1", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  PENDING_HR: { label: "En attente RH", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  APPROVED: { label: "Approuvé", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  REJECTED: { label: "Refusé", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  CANCELLED: { label: "Annulé", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

const fmt = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR");

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.errors) return Object.values(err.errors).flat().join(" ");
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LeavesPage() {
  const { user } = useAuth();
  const canReview = hasPermission(user, "leaves.approve_n1") || hasPermission(user, "leaves.approve_final_rh");

  const [tab, setTab] = useState<Tab>("mine");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState("");

  // Mes congés
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [mine, setMine] = useState<MyLeaveRequest[]>([]);
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineKey, setMineKey] = useState(0);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  // À valider
  const [pending, setPending] = useState<PendingLeave[]>([]);
  const [pendingKey, setPendingKey] = useState(0);
  const [decision, setDecision] = useState<{ item: PendingLeave; approved: boolean } | null>(null);
  const [comments, setComments] = useState("");

  // Calendrier
  const [month, setMonth] = useState("");
  const [calendar, setCalendar] = useState<CalendarLeave[]>([]);
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([leaveService.types(), leaveService.mine()])
      .then(([t, m]) => {
        if (cancelled) return;
        setTypes(t);
        setMine(m);
        setMineError(null);
        const now = new Date();
        setToday(isoDate(now));
        setMonth((v) => v || isoDate(now).slice(0, 7));
        setForm((f) => (f.leave_type_id || !t[0] ? f : { ...f, leave_type_id: t[0].id }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setMineError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setMineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mineKey]);

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    leaveService
      .pending()
      .then((p) => {
        if (!cancelled) setPending(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [canReview, pendingKey]);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    leaveService
      .calendar(month)
      .then((c) => {
        if (!cancelled) setCalendar(c);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedback({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [month, calendarKey]);

  const refresh = () => {
    setMineKey((k) => k + 1);
    setPendingKey((k) => k + 1);
    setCalendarKey((k) => k + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await leaveService.request({ ...form, reason: form.reason.trim() });
      setFeedback({ kind: "success", text: "Demande envoyée à votre responsable." });
      setForm((f) => ({ ...f, start_date: "", end_date: "", reason: "" }));
      refresh();
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    if (!decision) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await leaveService.review(decision.item, decision.approved, comments.trim() || undefined);
      setFeedback({ kind: "success", text: res.message });
      setDecision(null);
      setComments("");
      refresh();
    } catch (err) {
      setFeedback({ kind: "error", text: describe(err) });
    } finally {
      setBusy(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(isoDate(new Date(y, m - 1 + delta, 1)).slice(0, 7));
  };

  const monthLabel = month
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "";

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "mine", label: "Mes congés" },
    ...(canReview ? [{ key: "review" as Tab, label: "À valider", badge: pending.length }] : []),
    { key: "calendar", label: "Calendrier" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🏖️ Congés &amp; absences</h1>
            <p className="text-xs text-slate-400 mt-1">Demandes, circuit de validation N+1 puis RH, calendrier partagé (&sect;3.5)</p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${tab === t.key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {t.label}
                {!!t.badge && <span className="min-w-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mt-6 px-4 py-3 rounded-xl text-sm border ${
              feedback.kind === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
          </div>
        )}

        {tab === "mine" && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-8">
            <form onSubmit={submit} className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 h-fit">
              <h2 className="text-base font-bold text-white">Nouvelle demande</h2>
              {mineError ? (
                <p className="text-sm text-rose-300">⚠️ {mineError}</p>
              ) : (
                <>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Type de congé</span>
                    <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} required className={inputCls}>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-slate-400 mb-1">Du</span>
                      <input type="date" required min={today || undefined} value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-slate-400 mb-1">Au</span>
                      <input type="date" required min={form.start_date || today || undefined} value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className={inputCls} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Motif</span>
                    <textarea rows={3} required maxLength={500} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={inputCls} />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !form.leave_type_id || !form.start_date || !form.end_date || !form.reason.trim()}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl"
                  >
                    {busy ? "Envoi…" : "Envoyer la demande"}
                  </button>
                  <p className="text-[11px] text-slate-500">Seuls les jours ouvrés sont décomptés de votre solde.</p>
                </>
              )}
            </form>

            <section className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h2 className="text-base font-bold text-white">Mes demandes</h2>
              </div>
              <ul className="divide-y divide-slate-800">
                {mineLoading && <li className="p-6 text-center text-sm text-slate-400">Chargement…</li>}
                {!mineLoading && mine.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Aucune demande.</li>}
                {mine.map((r) => (
                  <li key={r.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {r.leave_type?.name ?? "Congé"} — {Number(r.total_days).toLocaleString("fr-FR")} j
                      </p>
                      <p className="text-xs text-slate-400">
                        Du {fmt(r.start_date)} au {fmt(r.end_date)}
                        {r.reason && <span className="text-slate-500"> &bull; {r.reason}</span>}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label ?? r.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === "review" && canReview && (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Demandes en attente de votre décision</h2>
              <p className="text-xs text-slate-400">N+1 : vos collaborateurs directs &bull; RH : validation finale des demandes déjà approuvées par le N+1.</p>
            </div>
            <ul className="divide-y divide-slate-800">
              {pending.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Rien à valider pour le moment.</li>}
              {pending.map((p) => (
                <li key={p.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      {p.employee.full_name} <span className="text-xs font-mono text-slate-500">{p.employee.matricule}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.leave_type ?? "Congé"} &bull; du {fmt(p.start_date)} au {fmt(p.end_date)} ({p.total_days.toLocaleString("fr-FR")} j ouvrés)
                      {p.employee.department && <> &bull; {p.employee.department}</>}
                    </p>
                    {p.reason && <p className="text-xs text-slate-500 mt-0.5">« {p.reason} »</p>}
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">{p.review_level === "N1" ? "Décision N+1" : "Validation RH"}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setDecision({ item: p, approved: true })} disabled={busy} className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded">
                      Approuver
                    </button>
                    <button
                      onClick={() => setDecision({ item: p, approved: false })}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/30"
                    >
                      Refuser
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "calendar" && (
          <section className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white capitalize">{monthLabel}</h2>
                <p className="text-xs text-slate-400">Absences de votre service et de votre équipe (toute l&rsquo;organisation pour la Direction et les RH)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => shiftMonth(-1)} aria-label="Mois précédent" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">
                  ←
                </button>
                <button onClick={() => setMonth(today.slice(0, 7))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">
                  Ce mois
                </button>
                <button onClick={() => shiftMonth(1)} aria-label="Mois suivant" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">
                  →
                </button>
              </div>
            </div>
            {month && <LeaveCalendar month={month} leaves={calendar} today={today} />}
          </section>
        )}

        {decision && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-1">{decision.approved ? "Approuver la demande" : "Refuser la demande"}</h3>
              <p className="text-sm text-slate-400 mb-4">
                {decision.item.employee.full_name} — du {fmt(decision.item.start_date)} au {fmt(decision.item.end_date)}
              </p>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Commentaire {decision.approved ? "(facultatif)" : "(motif du refus)"}</span>
                <textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} className={inputCls + " mb-4"} />
              </label>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDecision(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">
                  Annuler
                </button>
                <button
                  onClick={decide}
                  disabled={busy || (!decision.approved && !comments.trim())}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${decision.approved ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
