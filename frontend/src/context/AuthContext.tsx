"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/** Synchronise le jeton dans les clients API (ils le mettent en cache au chargement). */
function syncApiToken(token: string | null) {
  apiClient.setToken(token);
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  department: string;
  matricule: string;
  organizationName: string;
  /** Permissions effectives renvoyées par l'API ('*' = super administrateur). Absent en mode démo. */
  permissions?: string[];
}

/** Vérifie une permission côté interface (le backend reste l'autorité finale). */
export function hasPermission(user: AuthUser | null, slug: string): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return !!user.permissions && (user.permissions.includes("*") || user.permissions.includes(slug));
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  quickLoginAs: (roleSlug: string) => void;
}

// Comptes préconfigurés selon le Cahier des Charges (Section 4)
export const DEMO_ACCOUNTS: Record<string, AuthUser> = {
  super_admin: {
    id: "usr-admin",
    name: "Administrateur Système",
    email: "admin@ntemo.com",
    role: "super_admin",
    roleName: "Super Administrateur",
    department: "Direction Générale",
    matricule: "NTM-2026-000",
    organizationName: "NTEMO Consulting",
  },
  direction: {
    id: "usr-dir",
    name: "Glade NTOLANY",
    email: "direction@ntemo.com",
    role: "direction_generale",
    roleName: "Direction Générale & Lead Tech",
    department: "Direction Générale",
    matricule: "NTM-2026-001",
    organizationName: "NTEMO Consulting",
  },
  rh: {
    id: "usr-rh",
    name: "Awa NDIAYE",
    email: "rh@ntemo.com",
    role: "rh_administration",
    roleName: "Responsable RH & Administration",
    department: "Ressources Humaines",
    matricule: "NTM-2026-002",
    organizationName: "NTEMO Consulting",
  },
  manager: {
    id: "usr-mgr",
    name: "Jean MAVOUNGOU",
    email: "manager@ntemo.com",
    role: "project_manager",
    roleName: "Responsable de Projet / N+1",
    department: "Ingénierie & Projets Numériques",
    matricule: "NTM-2026-003",
    organizationName: "NTEMO Consulting",
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Vérification de la session locale au démarrage
    try {
      const storedUser = localStorage.getItem("ntemo_user");
      const storedToken = localStorage.getItem("ntemo_token");

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
    } catch {
      // Ignorer les erreurs de parsing
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Protection automatique des routes : redirection vers /login si non authentifié
  useEffect(() => {
    if (isLoading) return;

    const isLoginPage = pathname === "/login";
    if (!user && !isLoginPage) {
      router.push("/login");
    } else if (user && isLoginPage) {
      router.push("/");
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password = "password") => {
    try {
      // Tentative d'authentification API Laravel
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password, device_name: "Web Admin NextJS" }),
      });

      if (res.ok) {
        const data = await res.json();
        const apiUser = data.data.user;
        const loggedUser: AuthUser = {
          id: apiUser.id,
          name: apiUser.name,
          email: apiUser.email,
          role: apiUser.roles?.[0] || "employee",
          roleName: apiUser.role_name || apiUser.roles?.[0] || "Collaborateur",
          department: apiUser.employee?.department || "Administration",
          matricule: apiUser.employee?.matricule || "—",
          organizationName: apiUser.organization?.name || "NTEMO Consulting",
          permissions: apiUser.permissions ?? [],
        };
        const authToken = data.data.token;

        setUser(loggedUser);
        setToken(authToken);
        localStorage.setItem("ntemo_user", JSON.stringify(loggedUser));
        localStorage.setItem("ntemo_token", authToken);
        syncApiToken(authToken);
        router.push("/");
        return { success: true };
      }
    } catch {
      // En cas de backend hors ligne ou accès local, repli sur le catalogue RBAC officiel
    }

    // Authentification de démonstration locale avec les rôles du Cahier des Charges
    const match = Object.values(DEMO_ACCOUNTS).find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (match) {
      const generatedToken = `demo-token-${match.role}-${Date.now()}`;
      setUser(match);
      setToken(generatedToken);
      localStorage.setItem("ntemo_user", JSON.stringify(match));
      localStorage.setItem("ntemo_token", generatedToken);
      syncApiToken(generatedToken);
      router.push("/");
      return { success: true };
    }

    return { success: false, message: "Identifiants invalides. Veuillez vérifier votre adresse e-mail." };
  };

  const quickLoginAs = (roleSlug: string) => {
    const account = DEMO_ACCOUNTS[roleSlug];
    if (account) {
      const generatedToken = `demo-token-${account.role}-${Date.now()}`;
      setUser(account);
      setToken(generatedToken);
      localStorage.setItem("ntemo_user", JSON.stringify(account));
      localStorage.setItem("ntemo_token", generatedToken);
      syncApiToken(generatedToken);
      router.push("/");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("ntemo_user");
    localStorage.removeItem("ntemo_token");
    syncApiToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        quickLoginAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

