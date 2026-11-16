"use client";

import React, { useEffect, useState } from "react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { hasPermission, useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  settingsService,
  type AttendanceConfig,
  type DigestFrequency,
  type OrganizationInfo,
  type OrganizationSettings,
  type Weekday,
} from "@/lib/services/settingsService";

type TabKey = "organisation" | "pointage" | "conges" | "notifications" | "securite";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "organisation", label: "Organisation", icon: "🏢" },
  { key: "pointage", label: "Pointage", icon: "⏱️" },
  { key: "conges", label: "Congés", icon: "🏖️" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "securite", label: "Sécurité", icon: "🔒" },
];

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "monday", label: "Lun" },
  { key: "tuesday", label: "Mar" },
  { key: "wednesday", label: "Mer" },
  { key: "thursday", label: "Jeu" },
  { key: "friday", label: "Ven" },
  { key: "saturday", label: "Sam" },
  { key: "sunday", label: "Dim" },
];

const TIMEZONES = [
  { value: "Africa/Brazzaville", label: "Africa/Brazzaville (UTC+1)" },
  { value: "Africa/Kinshasa", label: "Africa/Kinshasa (UTC+1)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (UTC+1)" },
  { value: "Africa/Libreville", label: "Africa/Libreville (UTC+1)" },
  { value: "Africa/Douala", label: "Africa/Douala (UTC+1)" },
  { value: "Europe/Paris", label: "Europe/Paris (UTC+1/+2)" },
];

/* ── Shared Input Classes ────────────────────────────────────── */
const inputCls =
  "w-full bg-slate-800/60 text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border-0 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed";
const selectCls = inputCls + " appearance-none";

/* ── Toggle Switch ───────────────────────────────────────────── */
function Toggle({
  enabled,
  onToggle,
  disabled = false,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-sky-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  title,
  hint,
  enabled,
  onToggle,
  disabled,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-800/40 rounded-xl p-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} disabled={disabled} label={title} />
    </div>
  );
}

/* ── Reusable Field Wrapper ──────────────────────────────────── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

/* ── Section Card (défini hors du composant page : pas de remontage à chaque frappe) ── */
function SectionCard({
  title,
  description,
  children,
  onSave,
  saving,
  canEdit,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      {children}
      {onSave && canEdit && (
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-xl shadow-md shadow-sky-500/20 transition-colors"
          >
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      )}
    </div>
  );
}

type Feedback = { kind: "success" | "error"; text: string };

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "Action non autorisée : la permission « settings.manage » est requise.";
    if (err.status === 401) return "Session expirée ou mode démonstration : reconnectez-vous avec un compte réel.";
    if (err.errors) return Object.values(err.errors).flat().join(" ");
  }
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "settings.manage");

  const [activeTab, setActiveTab] = useState<TabKey>("organisation");
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    settingsService
      .get()
      .then((data) => {
        if (cancelled) return;
        setOrg(data.organization);
        setSettings(data.settings);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (feedback?.kind !== "success") return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  /* ── Helpers de mise à jour locale ─────────────────────────── */
  const patchOrg = (patch: Partial<OrganizationInfo>) => setOrg((o) => (o ? { ...o, ...patch } : o));
  const patchAttendance = (patch: Partial<AttendanceConfig>) =>
    setSettings((s) => (s ? { ...s, attendance: { ...s.attendance, ...patch } } : s));
  const patchSettings = <K extends keyof OrganizationSettings>(key: K, patch: Partial<OrganizationSettings[K]>) =>
    setSettings((s) => (s ? { ...s, [key]: { ...(s[key] as object), ...patch } } : s));

  const toggleWorkingDay = (day: Weekday) =>
    setSettings((s) => {
      if (!s) return s;
      const has = s.working_days.includes(day);
      const next = has ? s.working_days.filter((d) => d !== day) : [...s.working_days, day];
      // Conserver l'ordre de la semaine
      return { ...s, working_days: WEEKDAYS.map((w) => w.key).filter((k) => next.includes(k)) };
    });

  const run = async (section: string, action: () => Promise<void>) => {
    setSaving(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", text: `Section « ${section} » enregistrée avec succès.` });
    } catch (err) {
      setFeedback({ kind: "error", text: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  /* ── Sauvegardes par section ───────────────────────────────── */
  const saveOrganisation = () =>
    run("Organisation", async () => {
      if (!org) return;
      const data = await settingsService.update({
        organization: {
          name: org.name,
          email: org.email || null,
          phone: org.phone || null,
          address: org.address || null,
          city: org.city || null,
          country: org.country || null,
          timezone: org.timezone,
        },
      });
      setOrg(data.organization);
      setSettings(data.settings);
    });

  const savePointage = () =>
    run("Pointage", async () => {
      if (!settings) return;
      if (settings.working_days.length === 0) throw new Error("Sélectionnez au moins un jour ouvré.");
      const { qr_expiry_seconds: _fixed, ...attendance } = settings.attendance;
      void _fixed;
      const updated = await settingsService.updateAttendance(attendance);
      const data = await settingsService.update({ working_days: settings.working_days });
      setSettings({ ...data.settings, attendance: updated });
    });

  const saveConges = () =>
    run("Congés", async () => {
      if (!settings) return;
      const { approval_workflow: _fixed, ...policy } = settings.leave_policy;
      void _fixed;
      const data = await settingsService.update({ leave_quotas: settings.leave_quotas, leave_policy: policy });
      setSettings(data.settings);
    });

  const saveNotifications = () =>
    run("Notifications", async () => {
      if (!settings) return;
      const data = await settingsService.update({ notification_preferences: settings.notification_preferences });
      setSettings(data.settings);
    });

  const ro = !canEdit || saving;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white">⚙️ Paramètres &amp; Configuration</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configurez les règles métier et les notifications de {org?.name ?? "NTEMO ONE"}
          </p>
        </div>

        {!canEdit && !loading && !loadError && (
          <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
            🔒 Consultation seule : la modification des paramètres requiert la permission « settings.manage ».
          </div>
        )}

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${
              feedback.kind === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {feedback.kind === "success" ? "✅" : "⚠️"} {feedback.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-800 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="p-10 text-center text-sm text-slate-400 bg-slate-900/70 border border-slate-800 rounded-2xl">
            Chargement des paramètres…
          </div>
        )}

        {!loading && loadError && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start justify-between gap-4">
            <p className="text-sm text-red-300">⚠️ {loadError}</p>
            <button
              onClick={reload}
              className="flex-shrink-0 px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !loadError && org && settings && (
          <>
            {/* ── TAB: Organisation ──────────────────────── */}
            {activeTab === "organisation" && (
              <SectionCard
                title="Informations de l’Organisation"
                description="Identité et coordonnées de votre entreprise"
                onSave={saveOrganisation}
                saving={saving}
                canEdit={canEdit}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Nom de l’entreprise">
                    <input
                      type="text"
                      value={org.name}
                      onChange={(e) => patchOrg({ name: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Email de contact">
                    <input
                      type="email"
                      value={org.email ?? ""}
                      onChange={(e) => patchOrg({ email: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      value={org.phone ?? ""}
                      onChange={(e) => patchOrg({ phone: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Fuseau horaire">
                    <select
                      value={org.timezone}
                      onChange={(e) => patchOrg({ timezone: e.target.value })}
                      disabled={ro}
                      className={selectCls}
                    >
                      {!TIMEZONES.some((t) => t.value === org.timezone) && (
                        <option value={org.timezone}>{org.timezone}</option>
                      )}
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ville">
                    <input
                      type="text"
                      value={org.city ?? ""}
                      onChange={(e) => patchOrg({ city: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Pays">
                    <input
                      type="text"
                      value={org.country ?? ""}
                      onChange={(e) => patchOrg({ country: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Adresse complète">
                  <textarea
                    value={org.address ?? ""}
                    onChange={(e) => patchOrg({ address: e.target.value })}
                    rows={2}
                    disabled={ro}
                    className={inputCls + " resize-none"}
                  />
                </Field>
              </SectionCard>
            )}

            {/* ── TAB: Pointage ──────────────────────────── */}
            {activeTab === "pointage" && (
              <SectionCard
                title="Configuration du Pointage"
                description="QR code dynamique, horaires de travail, pauses et jours ouvrés"
                onSave={savePointage}
                saving={saving}
                canEdit={canEdit}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field
                    label="Validité du QR Code dynamique"
                    hint="Imposée par le moteur de pointage (Cahier des Charges) — non modifiable."
                  >
                    <input
                      type="text"
                      value={`${settings.attendance.qr_expiry_seconds} secondes`}
                      readOnly
                      disabled
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Période de grâce retard (minutes)" hint="Tolérance avant de marquer un retard (0 à 60).">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={settings.attendance.grace_period_minutes}
                      onChange={(e) => patchAttendance({ grace_period_minutes: Number(e.target.value) })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Heure de début de journée">
                    <input
                      type="time"
                      value={settings.attendance.working_hours_start}
                      onChange={(e) => patchAttendance({ working_hours_start: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Heure de fin de journée">
                    <input
                      type="time"
                      value={settings.attendance.working_hours_end}
                      onChange={(e) => patchAttendance({ working_hours_end: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Début pause déjeuner">
                    <input
                      type="time"
                      value={settings.attendance.lunch_break_start}
                      onChange={(e) => patchAttendance({ lunch_break_start: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Fin pause déjeuner">
                    <input
                      type="time"
                      value={settings.attendance.lunch_break_end}
                      onChange={(e) => patchAttendance({ lunch_break_end: e.target.value })}
                      disabled={ro}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Jours ouvrés</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const active = settings.working_days.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          aria-pressed={active}
                          disabled={ro}
                          onClick={() => toggleWorkingDay(day.key)}
                          className={`w-14 py-2 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            active ? "bg-sky-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <ToggleRow
                    title="Dépointage automatique"
                    hint="Clôturer automatiquement les présences restées ouvertes à l’heure définie"
                    enabled={settings.attendance.auto_checkout_enabled}
                    onToggle={() => patchAttendance({ auto_checkout_enabled: !settings.attendance.auto_checkout_enabled })}
                    disabled={ro}
                  />
                  {settings.attendance.auto_checkout_enabled && (
                    <Field label="Heure du dépointage automatique">
                      <input
                        type="time"
                        value={settings.attendance.auto_checkout_time}
                        onChange={(e) => patchAttendance({ auto_checkout_time: e.target.value })}
                        disabled={ro}
                        className={inputCls}
                      />
                    </Field>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── TAB: Congés ────────────────────────────── */}
            {activeTab === "conges" && (
              <SectionCard
                title="Règles de Gestion des Congés"
                description="Quotas annuels, report et workflow de validation"
                onSave={saveConges}
                saving={saving}
                canEdit={canEdit}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(
                    [
                      ["annual", "Congés annuels (jours)"],
                      ["sick", "Congés maladie (jours)"],
                      ["maternity", "Congé maternité (jours)"],
                      ["paternity", "Congé paternité (jours)"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={settings.leave_quotas[key] ?? 0}
                        onChange={(e) => patchSettings("leave_quotas", { [key]: Number(e.target.value) })}
                        disabled={ro}
                        className={inputCls}
                      />
                    </Field>
                  ))}
                </div>

                <ToggleRow
                  title="Report de congés autorisé"
                  hint="Permettre le report des jours non utilisés sur l’exercice suivant"
                  enabled={settings.leave_policy.carry_over_enabled}
                  onToggle={() =>
                    patchSettings("leave_policy", { carry_over_enabled: !settings.leave_policy.carry_over_enabled })
                  }
                  disabled={ro}
                />
                <Field label="Report maximum (jours)">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={settings.leave_policy.carry_over_max_days}
                    onChange={(e) => patchSettings("leave_policy", { carry_over_max_days: Number(e.target.value) })}
                    disabled={ro || !settings.leave_policy.carry_over_enabled}
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="Workflow de validation"
                  hint="Défini par le Cahier des Charges et appliqué par le moteur de congés — non modifiable."
                >
                  <input type="text" value="2 niveaux : N+1 puis RH" readOnly disabled className={inputCls} />
                </Field>
              </SectionCard>
            )}

            {/* ── TAB: Notifications ─────────────────────── */}
            {activeTab === "notifications" && (
              <SectionCard
                title="Canaux de Notifications"
                description="Activez ou désactivez les canaux et choisissez la fréquence du résumé"
                onSave={saveNotifications}
                saving={saving}
                canEdit={canEdit}
              >
                <div className="space-y-3">
                  {(
                    [
                      ["email_enabled", "Notifications par Email", "Recevoir les alertes et rappels par courrier électronique"],
                      ["sms_enabled", "Notifications par SMS", "Alertes critiques envoyées par message texte"],
                      ["push_enabled", "Notifications Push", "Notifications instantanées dans le navigateur ou l’application mobile"],
                    ] as const
                  ).map(([key, title, hint]) => (
                    <ToggleRow
                      key={key}
                      title={title}
                      hint={hint}
                      enabled={settings.notification_preferences[key]}
                      onToggle={() =>
                        patchSettings("notification_preferences", { [key]: !settings.notification_preferences[key] })
                      }
                      disabled={ro}
                    />
                  ))}
                </div>

                <Field label="Fréquence du résumé (digest)">
                  <select
                    value={settings.notification_preferences.digest_frequency}
                    onChange={(e) =>
                      patchSettings("notification_preferences", { digest_frequency: e.target.value as DigestFrequency })
                    }
                    disabled={ro}
                    className={selectCls}
                  >
                    <option value="realtime">Temps réel</option>
                    <option value="daily">Résumé quotidien</option>
                    <option value="weekly">Résumé hebdomadaire</option>
                    <option value="off">Désactivé</option>
                  </select>
                </Field>
              </SectionCard>
            )}

            {/* ── TAB: Sécurité ──────────────────────────── */}
            {activeTab === "securite" && (
              <SectionCard
                title="Politique de Sécurité"
                description="Mécanismes de sécurité actuellement appliqués par la plateforme"
                canEdit={canEdit}
              >
                <ul className="space-y-3 text-sm">
                  {[
                    ["Authentification par jeton", "Jetons Sanctum révoqués à la déconnexion."],
                    ["Contrôle d’accès RBAC", "Chaque action sensible est vérifiée côté serveur par permission."],
                    ["Cloisonnement multi-organisation", "Les données et rôles sont isolés par organisation."],
                    ["QR de pointage signé", "Jeton signé, à usage unique, valable 15 secondes."],
                  ].map(([title, hint]) => (
                    <li key={title} className="flex items-start gap-3 bg-slate-800/40 rounded-xl p-4">
                      <span className="text-emerald-400">✓</span>
                      <div>
                        <p className="font-medium text-white">{title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  La politique de mot de passe, la double authentification (2FA), l’expiration de session et la
                  liste blanche d’adresses IP ne sont pas encore configurables : ces réglages seront proposés ici
                  lorsqu’ils seront appliqués par le serveur.
                </p>
              </SectionCard>
            )}
          </>
        )}
      </main>
    </div>
  );
}
