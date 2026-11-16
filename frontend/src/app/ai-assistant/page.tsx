"use client";

import React, { useEffect, useRef, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { aiService, type AiConversation, type AiMessage, type AiStatus } from "@/lib/services/aiService";

type Tab = "chat" | "draft";

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500";

const QUICK_PROMPTS = [
  "Rédige un courrier de bienvenue pour un nouveau collaborateur.",
  "Propose une note de service sur les nouveaux horaires d'accueil.",
  "Comment formuler une demande de justificatif d'absence avec tact ?",
];

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.status === 403) return "L'assistant IA n'est pas ouvert à votre profil.";
    if (err.errors) return Object.values(err.errors).flat().join(" ");
    return err.message;
  }
  if (err instanceof TypeError) return "Serveur injoignable. Vérifiez que l'API est démarrée.";
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="text-[11px] text-slate-400 hover:text-white border border-slate-700 rounded px-2 py-0.5"
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const allowed = hasPermission(user, "ai.use");

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const [taskType, setTaskType] = useState("DRAFT_LETTER");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<{ text: string; source?: string } | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    Promise.all([aiService.status(), aiService.conversations()])
      .then(([s, c]) => {
        if (cancelled) return;
        setStatus(s);
        setConversations(c);
        if (c[0]) {
          setActiveId(c[0].id);
          setMessages(c[0].messages ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describe(err));
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const openConversation = (c: AiConversation) => {
    setActiveId(c.id);
    setMessages(c.messages ?? []);
    setError(null);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      let id = activeId;
      if (!id) {
        const conv = await aiService.createConversation(content.slice(0, 80));
        id = conv.id;
        setActiveId(id);
        setConversations((list) => [{ ...conv, messages: [] }, ...list]);
      }
      // Affichage immédiat de la question pendant la rédaction de la réponse
      setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() }]);
      const res = await aiService.send(id, content);
      setMessages((m) => [...m.filter((x) => !x.id.startsWith("tmp-")), res.user_message, res.assistant_message]);
      setConversations((list) =>
        list.map((c) => (c.id === id ? { ...c, messages: [...(c.messages ?? []), res.user_message, res.assistant_message] } : c)),
      );
    } catch (err) {
      setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
      setInput(content);
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const generateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const d = await aiService.draft(taskType, prompt.trim());
      setDraft({ text: d.generated_draft, source: d.source });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🤖 Assistant NTEMO AI</h1>
            <p className="text-xs text-slate-400 mt-1">Rédaction de courriers, fiches de poste, clauses, synthèses et plans de présentation (&sect;3.5)</p>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full border ${status.enabled ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}`}
              >
                {status.enabled ? "IA activée" : "Mode démonstration"}
              </span>
            )}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              {(["chat", "draft"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg ${tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {t === "chat" ? "Discussion" : "Rédaction assistée"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!allowed ? (
          <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300 max-w-2xl">
            🔒 L&rsquo;assistant IA requiert la permission « Utiliser assistant IA ».
          </div>
        ) : (
          <>
            {status && !status.enabled && (
              <p className="mt-6 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                L&rsquo;IA n&rsquo;est pas encore activée sur ce serveur : les réponses sont des trames types. L&rsquo;administrateur doit
                renseigner la clé <code className="font-mono">ANTHROPIC_API_KEY</code> dans la configuration de l&rsquo;API.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-6 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                ⚠️ {error}
              </p>
            )}

            {tab === "chat" ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                <aside className="bg-slate-900 border border-slate-800 rounded-2xl p-4 h-fit space-y-2">
                  <button
                    onClick={() => {
                      setActiveId(null);
                      setMessages([]);
                    }}
                    className="w-full px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                  >
                    + Nouvelle discussion
                  </button>
                  <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {conversations.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => openConversation(c)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${c.id === activeId ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"}`}
                        >
                          {c.title}
                        </button>
                      </li>
                    ))}
                    {conversations.length === 0 && <li className="text-xs text-slate-500 px-2">Aucune discussion.</li>}
                  </ul>
                </aside>

                <section className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-[65vh]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4" aria-live="polite">
                    {messages.length === 0 && !busy && (
                      <div className="text-center text-slate-400 py-10 space-y-4">
                        <p className="text-sm">Posez une question ou demandez un brouillon.</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {QUICK_PROMPTS.map((q) => (
                            <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 border border-slate-700 rounded-full hover:bg-slate-800 text-slate-300">
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-950 border border-slate-800 text-slate-200"}`}
                        >
                          {m.content}
                          {m.role === "assistant" && (
                            <div className="mt-2 flex justify-end">
                              <CopyButton text={m.content} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {busy && <p className="text-xs text-slate-400 animate-pulse">NTEMO AI rédige…</p>}
                    <div ref={endRef} />
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(input);
                    }}
                    className="border-t border-slate-800 p-4 flex gap-3"
                  >
                    <textarea
                      rows={2}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send(input);
                        }
                      }}
                      maxLength={8000}
                      placeholder="Votre demande… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
                      aria-label="Message à l'assistant"
                      className={inputCls + " resize-none"}
                    />
                    <button type="submit" disabled={busy || !input.trim()} className="px-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl">
                      Envoyer
                    </button>
                  </form>
                </section>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                <form onSubmit={generateDraft} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 h-fit">
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">Type de document</span>
                    <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={inputCls}>
                      {Object.entries(status?.task_types ?? { DRAFT_LETTER: "Courrier administratif" }).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">
                      {taskType === "SUMMARIZE_REPORT" ? "Texte à synthétiser" : "Votre demande (destinataire, objet, éléments clés…)"}
                    </span>
                    <textarea rows={taskType === "SUMMARIZE_REPORT" ? 14 : 8} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={20000} className={inputCls} />
                  </label>
                  <button type="submit" disabled={busy || !prompt.trim()} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl">
                    {busy ? "Rédaction en cours…" : "Générer le brouillon"}
                  </button>
                  <p className="text-[11px] text-slate-500">
                    Le brouillon est à relire et valider avant tout envoi. Les textes saisis sont transmis au service d&rsquo;IA pour traitement :
                    n&rsquo;y mettez pas de données personnelles inutiles.
                  </p>
                </form>
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[40vh]">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-white">Brouillon</h2>
                    {draft && <CopyButton text={draft.text} />}
                  </div>
                  {draft ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">{draft.text}</pre>
                  ) : (
                    <p className="text-sm text-slate-500">{busy ? "NTEMO AI rédige…" : "Le brouillon généré s'affichera ici."}</p>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
