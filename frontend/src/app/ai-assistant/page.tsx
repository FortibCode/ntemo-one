"use client";

import React, { useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: string;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-1",
      sender: "ai",
      content:
        "Bonjour ! Je suis **NTEMO AI**, votre assistant administratif intelligent. Je peux vous aider à rédiger des attestations de travail, synthétiser des comptes rendus de réunion, formaliser des contrats ou préparer des trames de présentation.",
      timestamp: "10:00",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState("LETTER");

  const quickPrompts = [
    {
      title: "Lettre de mission d'audit",
      prompt: "Rédige une lettre de mission officielle pour un audit SIRH chez notre client Alpha, durée 3 semaines.",
      type: "LETTER",
    },
    {
      title: "Avenant de prolongation CDD",
      prompt: "Génère un projet d'avenant contractuel pour prolonger de 6 mois le CDD d'un ingénieur logiciel.",
      type: "CONTRACT",
    },
    {
      title: "Compte rendu de réunion RH",
      prompt: "Formule une synthèse structurée des décisions prises lors du comité de suivi des présences de novembre 2026.",
      type: "SUMMARY",
    },
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || isGenerating) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsGenerating(true);

    // Simulation de réponse IA spécialisée RH & NTEMO Consulting
    setTimeout(() => {
      let aiReply = "";
      if (text.toLowerCase().includes("mission") || selectedTaskType === "LETTER") {
        aiReply = `### ORDRE DE MISSION OFFICIEL — NTEMO CONSULTING

**Réf :** NTM/ODM/2026-11/042  
**Date :** 02 Novembre 2026  
**Émetteur :** Direction Générale & RH  
**Destinataire :** Jean MAVOUNGOU (Matricule : NTM-2026-003)

**Objet :** Mission d'assistance à maîtrise d'ouvrage et audit du SIRH client.

Par la présente, il est confié à Monsieur Jean MAVOUNGOU, en sa qualité de Chef de Projet au sein de NTEMO Consulting, la conduite de la mission d'évaluation des processus RH et de déploiement de la solution NTEMO ONE auprès de l'entreprise partenaire.

- **Période :** Du 05 Novembre au 26 Novembre 2026  
- **Lieu d'exécution :** Brazzaville (Sites opérationnels & télétravail sécurisé)  
- **Objectifs clés :**  
  1. Cartographie des flux de pointage et validation des horaires.  
  2. Paramétrage des modèles documentaires certifiés.  
  3. Formation des utilisateurs clés à la borne de pointage dynamique (15s).

Fait à Brazzaville, le 02 Novembre 2026  
*Pour faire valoir ce que de droit.*

**Direction Générale — NTEMO Consulting**`;
      } else if (text.toLowerCase().includes("contrat") || text.toLowerCase().includes("cdd")) {
        aiReply = `### PROJET D'AVENANT AU CONTRAT DE TRAVAIL (CDD)

**ENTRE LES SOUSSIGNÉS :**  
**NTEMO Consulting**, société de conseil sise à Brazzaville, représentée par sa Direction Générale,  
*D'une part,*

**ET :**  
Le collaborateur désigné ci-après,  
*D'autre part,*

**IL A ÉTÉ CONVENU CE QUI SUIT :**  
**Article 1 : Prolongation du terme du contrat**  
Le contrat de travail à durée déterminée conclu initialement est prolongé pour une période ferme de 6 (six) mois à compter du 16 Novembre 2026.

**Article 2 : Maintien des autres dispositions**  
Toutes les autres clauses du contrat initial relatives à la rémunération, à la confidentialité et aux obligations de service demeurent inchangées.`;
      } else {
        aiReply = `Voici l'ébauche générée pour votre demande :

**Synthèse des points clés :**
1. **Conformité & Présences :** 94.2% de taux de présence constaté sur la plateforme NTEMO ONE avec zéro réclamation sur les jetons dynamiques 15 secondes.
2. **Gestion Documentaire :** Automatisation validée pour les attestations et relevés d'heures mensuels.
3. **Recommandations RH :** Clôturer les 2 entretiens de renouvellement de contrat avant le 15 novembre.

*Vous pouvez copier ce texte directement dans le module Générateur de Documents.*`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          content: aiReply,
          timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="pb-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Assistant IA NTEMO AI
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Module Cahier des Charges &sect;3.5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Génération automatique de brouillons, contrats types, synthèses et assistance administrative
            </p>
          </div>
        </div>

        {/* Quick Prompts Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedTaskType(qp.type);
                handleSendMessage(qp.prompt);
              }}
              className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 rounded-xl text-left transition-all group"
            >
              <div className="text-xs font-bold text-white group-hover:text-indigo-400">
                {qp.title}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{qp.prompt}</div>
            </button>
          ))}
        </div>

        {/* Chat Conversation Area */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-4 mb-4 min-h-[400px]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start space-x-3 ${
                m.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                  m.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-indigo-600/30 border border-indigo-500/40 text-indigo-300"
                }`}
              >
                {m.sender === "user" ? "VOUS" : "IA"}
              </div>

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-950 border border-slate-800 text-slate-200"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                <div
                  className={`mt-2 text-[10px] text-right ${
                    m.sender === "user" ? "text-blue-200" : "text-slate-500"
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-center space-x-3 text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <span>NTEMO AI analyse votre demande et prépare le document...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Décrivez le document à générer ou votre question administrative..."
            className="flex-1 bg-transparent border-none px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isGenerating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center space-x-1.5"
          >
            <span>Envoyer</span>
            <span>&rarr;</span>
          </button>
        </div>
      </main>
    </div>
  );
}

