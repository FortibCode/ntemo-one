import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "NTEMO ONE - Plateforme Intégrée RH, Présences & Automatisation",
  description: "Plateforme intégrée pour NTEMO Consulting - Présences QR 15s, Badges, Congés, Moteur Documentaire et Projets",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
