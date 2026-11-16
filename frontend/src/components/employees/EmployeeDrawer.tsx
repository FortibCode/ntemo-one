"use client";

import React, { useEffect, useState } from "react";
import EmployeeDocuments from "@/components/employees/EmployeeDocuments";
import { ApiError } from "@/lib/api";
import { roleService, type RoleSummary } from "@/lib/services/roleService";
import {
  employeeService,
  type ContractItem,
  type ContractType,
  type CreatedAccount,
  type EmployeeInput,
  type EmployeeItem,
  type Structure,
} from "@/lib/services/employeeService";

type Tab = "profile" | "contracts" | "documents" | "account";

export interface DrawerPermissions {
  canEdit: boolean;
  canContracts: boolean;
  canReadDocs: boolean;
  canUploadDocs: boolean;
  canAccounts: boolean;
}

interface Props {
  /** null = création d'un nouveau collaborateur */
  employee: EmployeeItem | null;
  structure: Structure;
  managers: { id: string; full_name: string; matricule: string }[];
  permissions: DrawerPermissions;
  onClose: () => void;
  onSaved: (e: EmployeeItem) => void;
}

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-60";

const CONTRACT_TYPES: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  STAGE: "Convention de stage",
  PRESTATION: "Contrat de prestation",
  APPRENTISSAGE: "Apprentissage",
};

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.errors) return Object.values(err.errors).flat().join(" ");
    return err.message;
  }
  return err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
}

const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—");

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="block text-xs font-semibold text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function toInput(e: EmployeeItem | null, today: string): EmployeeInput {
  return {
    first_name: e?.first_name ?? "",
    last_name: e?.last_name ?? "",
    email: e?.email ?? "",
    phone: e?.phone ?? "",
    gender: e?.gender ?? null,
    birth_date: e?.birth_date ?? "",
    nationality: e?.nationality ?? "",
    address: e?.address ?? "",
    city: e?.city ?? "",
    national_id_number: e?.national_id_number ?? "",
    department_id: e?.department?.id ?? "",
    position_id: e?.position?.id ?? "",
    manager_id: e?.manager?.id ?? "",
    hire_date: e?.hire_date ?? today,
    status: e?.status ?? "ACTIVE",
  };
}

/** Champs vides → null (l'API attend null, pas une chaîne vide). */
function clean(input: EmployeeInput): EmployeeInput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === "" ? null : v;
  return out as unknown as EmployeeInput;
}

export default function EmployeeDrawer({ employee, structure, managers, permissions, onClose, onSaved }: Props) {
  const isNew = employee === null;
  const [tab, setTab] = useState<Tab>("profile");
  const [form, setForm] = useState<EmployeeInput>(() => toInput(employee, ""));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Contrats
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [contractKey, setContractKey] = useState(0);
  const [contractForm, setContractForm] = useState({ type: "CDI" as ContractType, start_date: "", end_date: "", probation_end_date: "", gross_salary: "" });

  // Compte
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [roleId, setRoleId] = useState("");
  const [accountEmail, setAccountEmail] = useState(employee?.email ?? "");
  const [account, setAccount] = useState<CreatedAccount | null>(null);

  // Date du jour par défaut pour une création (côté client uniquement)
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setForm((f) => (f.hire_date ? f : { ...f, hire_date: iso }));
    });
    return () => clearTimeout(t);
  }, [isNew]);

  useEffect(() => {
    if (!employee || tab !== "contracts" || !permissions.canContracts) return;
    let cancelled = false;
    employeeService
      .contracts(employee.id)
      .then((c) => {
        if (!cancelled) setContracts(c);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMessage({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [employee, tab, contractKey, permissions.canContracts]);

  useEffect(() => {
    if (tab !== "account" || !permissions.canAccounts || roles.length > 0) return;
    let cancelled = false;
    roleService
      .list()
      .then((r) => {
        if (cancelled) return;
        setRoles(r);
        setRoleId(r.find((x) => x.slug === "employee")?.id ?? r[0]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setMessage({ kind: "error", text: describe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, permissions.canAccounts, roles.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof EmployeeInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = isNew ? await employeeService.create(clean(form)) : await employeeService.update(employee.id, clean(form));
      setMessage({ kind: "success", text: isNew ? `Dossier créé : matricule ${saved.matricule}.` : "Fiche mise à jour." });
      onSaved(saved);
    } catch (err) {
      setMessage({ kind: "error", text: describe(err) });
    } finally {
      setSaving(false);
    }
  };

  const addContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setSaving(true);
    setMessage(null);
    try {
      await employeeService.addContract(employee.id, {
        type: contractForm.type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || null,
        probation_end_date: contractForm.probation_end_date || null,
        gross_salary: contractForm.gross_salary ? Number(contractForm.gross_salary) : null,
      });
      setMessage({ kind: "success", text: "Contrat enregistré ; le contrat précédent est clôturé." });
      setContractForm({ type: "CDI", start_date: "", end_date: "", probation_end_date: "", gross_salary: "" });
      setContractKey((k) => k + 1);
    } catch (err) {
      setMessage({ kind: "error", text: describe(err) });
    } finally {
      setSaving(false);
    }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !roleId) return;
    setSaving(true);
    setMessage(null);
    try {
      setAccount(await employeeService.createAccount(employee.id, roleId, accountEmail));
    } catch (err) {
      setMessage({ kind: "error", text: describe(err) });
    } finally {
      setSaving(false);
    }
  };

  const positions = structure.positions.filter((p) => !form.department_id || !p.department_id || p.department_id === form.department_id);
  const readOnly = !permissions.canEdit;

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "profile", label: "Fiche", show: true },
    { key: "contracts", label: "Contrats", show: !isNew && permissions.canContracts },
    { key: "documents", label: "Pièces", show: !isNew && permissions.canReadDocs },
    { key: "account", label: "Compte", show: !isNew && permissions.canAccounts },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={onClose}>
      <aside className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 id="drawer-title" className="text-lg font-bold text-white">
              {isNew ? "Nouveau collaborateur" : employee.full_name}
            </h2>
            {!isNew && (
              <p className="text-xs text-slate-400 font-mono">
                {employee.matricule} &bull; {employee.position?.title ?? "Poste non défini"}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-white text-2xl leading-none">
            ×
          </button>
        </header>

        <nav className="px-6 pt-3 flex gap-1 border-b border-slate-800">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setMessage(null);
                }}
                className={`px-3 py-2 text-sm rounded-t-lg ${tab === t.key ? "bg-slate-950 text-white border border-b-0 border-slate-800" : "text-slate-400 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={`text-sm rounded-lg px-3 py-2 border ${message.kind === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-rose-300 bg-rose-500/10 border-rose-500/30"}`}
            >
              {message.kind === "success" ? "✅" : "⚠️"} {message.text}
            </p>
          )}

          {tab === "profile" && (
            <form onSubmit={save} className="space-y-5">
              <fieldset disabled={readOnly} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Prénom *">
                  <input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Nom *">
                  <input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className={inputCls} />
                </Field>
                <Field label="E-mail professionnel">
                  <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Téléphone">
                  <input type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Genre">
                  <select value={form.gender ?? ""} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    <option value="F">Femme</option>
                    <option value="M">Homme</option>
                  </select>
                </Field>
                <Field label="Date de naissance">
                  <input type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Nationalité">
                  <input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} className={inputCls} />
                </Field>
                <Field label="N° pièce d'identité">
                  <input value={form.national_id_number ?? ""} onChange={(e) => set("national_id_number", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Adresse" wide>
                  <input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Ville">
                  <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Date d'embauche *">
                  <input type="date" required value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} className={inputCls} />
                </Field>
              </fieldset>

              <fieldset disabled={readOnly} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <legend className="text-sm font-semibold text-white mb-2">Affectation</legend>
                <Field label="Service">
                  <select
                    value={form.department_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value, position_id: "" }))}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {structure.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Poste">
                  <select value={form.position_id ?? ""} onChange={(e) => set("position_id", e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsable direct (N+1)">
                  <select value={form.manager_id ?? ""} onChange={(e) => set("manager_id", e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {managers
                      .filter((m) => m.id !== employee?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.matricule})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Statut">
                  <select value={form.status ?? "ACTIVE"} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                    <option value="ACTIVE">Actif</option>
                    <option value="ON_LEAVE">En congé longue durée</option>
                    <option value="SUSPENDED">Suspendu</option>
                    <option value="TERMINATED">Sorti des effectifs</option>
                  </select>
                </Field>
              </fieldset>

              {!readOnly && (
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl">
                    {saving ? "Enregistrement…" : isNew ? "Créer le dossier" : "Enregistrer"}
                  </button>
                </div>
              )}
            </form>
          )}

          {tab === "contracts" && employee && (
            <>
              <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
                {contracts.length === 0 && <li className="p-4 text-sm text-slate-500">Aucun contrat enregistré.</li>}
                {contracts.map((c) => (
                  <li key={c.id} className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-medium">
                        {CONTRACT_TYPES[c.type] ?? c.type}
                        {c.reference && <span className="text-xs text-slate-500 font-mono ml-2">{c.reference}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        Du {fmt(c.start_date)} {c.end_date ? `au ${fmt(c.end_date)}` : "— durée indéterminée"}
                        {c.probation_end_date && <> &bull; fin d&rsquo;essai le {fmt(c.probation_end_date)}</>}
                      </p>
                      {c.gross_salary !== null && (
                        <p className="text-xs text-slate-500">
                          {c.gross_salary.toLocaleString("fr-FR")} {c.currency} brut / mois
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${c.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-600"}`}
                    >
                      {c.status === "ACTIVE" ? "En cours" : "Clôturé"}
                    </span>
                  </li>
                ))}
              </ul>

              <form onSubmit={addContract} className="border border-dashed border-slate-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">Nouveau contrat</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Type">
                    <select value={contractForm.type} onChange={(e) => setContractForm((f) => ({ ...f, type: e.target.value as ContractType }))} className={inputCls}>
                      {(Object.keys(CONTRACT_TYPES) as ContractType[]).map((t) => (
                        <option key={t} value={t}>
                          {CONTRACT_TYPES[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Salaire brut mensuel">
                    <input type="number" min={0} value={contractForm.gross_salary} onChange={(e) => setContractForm((f) => ({ ...f, gross_salary: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Début *">
                    <input type="date" required value={contractForm.start_date} onChange={(e) => setContractForm((f) => ({ ...f, start_date: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label={contractForm.type === "CDI" ? "Fin (facultative)" : "Fin *"}>
                    <input
                      type="date"
                      required={contractForm.type !== "CDI"}
                      min={contractForm.start_date || undefined}
                      value={contractForm.end_date}
                      onChange={(e) => setContractForm((f) => ({ ...f, end_date: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Fin de période d'essai">
                    <input
                      type="date"
                      min={contractForm.start_date || undefined}
                      value={contractForm.probation_end_date}
                      onChange={(e) => setContractForm((f) => ({ ...f, probation_end_date: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-slate-500">Le contrat en cours sera clôturé. Les échéances alimentent les alertes du tableau de bord.</p>
                <button type="submit" disabled={saving || !contractForm.start_date} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">
                  Enregistrer le contrat
                </button>
              </form>
            </>
          )}

          {tab === "documents" && employee && <EmployeeDocuments employeeId={employee.id} canUpload={permissions.canUploadDocs} />}

          {tab === "account" && employee && (
            <div className="space-y-4">
              {account ? (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                  <p className="text-sm font-semibold text-amber-300">Compte créé — mot de passe provisoire</p>
                  <p className="text-sm text-slate-300">
                    Identifiant : <span className="font-mono text-white">{account.email}</span>
                    <br />
                    Mot de passe : <span className="font-mono text-white text-base select-all">{account.temporary_password}</span>
                    <br />
                    Rôle : {account.role}
                  </p>
                  <p className="text-xs text-slate-400">Transmettez-le au collaborateur de façon sécurisée : il ne sera plus jamais affiché.</p>
                </div>
              ) : employee.has_account ? (
                <p className="text-sm text-slate-300">
                  ✅ Ce collaborateur possède un compte de connexion. Ses rôles se gèrent dans <span className="text-white">Rôles &amp; Permissions → Attribution</span>.
                </p>
              ) : (
                <form onSubmit={createAccount} className="space-y-3">
                  <p className="text-sm text-slate-400">Créez l&rsquo;accès du collaborateur à NTEMO ONE (web et application mobile).</p>
                  <Field label="E-mail de connexion">
                    <input type="email" required value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Rôle">
                    <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputCls}>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button type="submit" disabled={saving || !roleId || !accountEmail} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">
                    {saving ? "Création…" : "Créer le compte"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
