import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NTEMO ONE - Plateforme RH & Présences",
  description: "Plateforme intégrée de gestion des ressources humaines, présences et projets pour NTEMO Consulting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
