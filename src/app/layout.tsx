import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hotel Fêmi — Séjour & facturation interne",
  description:
    "Outil interne de préparation des documents de séjour, de calcul des montants et de suivi des paiements de l'Hotel Fêmi (Bénin).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="grain min-h-screen antialiased">{children}</body>
    </html>
  );
}
