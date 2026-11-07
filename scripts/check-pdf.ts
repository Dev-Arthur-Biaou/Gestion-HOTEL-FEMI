/**
 * Vérification ponctuelle du générateur PDF (exécuté avec tsx pendant la recette).
 * Utilise les mêmes fonctions que le navigateur.
 */
import { writeFileSync } from "node:fs";
import { generateStayPdf, pdfFilename } from "@/lib/pdf";
import type { SettingsDTO, StayDTO } from "@/lib/types";

const BASE = "http://127.0.0.1:3000";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.FEMI_EMAIL ?? "reception@hotelfemi.bj",
      password: process.env.FEMI_PASSWORD ?? "femi2026",
    }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) throw new Error("Connexion impossible");

  const staysRes = await fetch(`${BASE}/api/stays`, { headers: { cookie } });
  const { stays } = (await staysRes.json()) as { stays: StayDTO[] };
  const settingsRes = await fetch(`${BASE}/api/settings`, { headers: { cookie } });
  const { settings } = (await settingsRes.json()) as { settings: SettingsDTO };

  const targets = [
    stays.find((s) => s.payments.length > 1) ?? stays[0],
    stays.find((s) => s.status === "annule") ?? stays[1],
    stays.find((s) => s.services.length > 2) ?? stays[2],
  ];

  for (const stay of targets) {
    const blob = await generateStayPdf(stay, settings);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const name = pdfFilename(stay);
    writeFileSync(`/tmp/${name}`, buffer);
    const header = buffer.subarray(0, 5).toString("latin1");
    console.log(
      `${name} — ${buffer.length} octets — entête ${header} — statut ${stay.status} — ${stay.services.length} service(s), ${stay.payments.length} paiement(s)`,
    );
    if (header !== "%PDF-") throw new Error("Fichier PDF invalide");
    if (buffer.length < 3000) throw new Error("PDF anormalement petit");
  }

  // Variante avec logo + coordonnées de paiement + taxe configurée
  const png1x1 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const enriched: SettingsDTO = {
    ...settings,
    logo: png1x1,
    address: "Quartier_test, Cotonou",
    phone: "+229 01 00 00 00",
    email: "contact@test.bj",
    footerText: "Merci de votre confiance.",
    commercialNotes: "Départ avant 11h00.",
    momoDetails: "MTN MoMo — 00 00 00 00",
    bankDetails: "Banque test — compte 000",
    paymentInfo: "Règlement à la réception.",
  };
  const base = targets[0];
  const taxed: StayDTO = {
    ...base,
    taxLabel: "Taxe test",
    taxRate: 5,
    totals: { ...base.totals, taxe: 4000, total: base.totals.total + 4000 },
    balance: { ...base.balance, solde: base.balance.solde + 4000 },
    fees: [{ label: "Frais test", mode: "pourcentage", value: 3 }],
  };
  const blob = await generateStayPdf(taxed, enriched);
  const buffer = Buffer.from(await blob.arrayBuffer());
  writeFileSync("/tmp/pdf-avec-logo.pdf", buffer);
  console.log(`pdf-avec-logo.pdf — ${buffer.length} octets — logo + taxe + frais + coordonnées`);
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("PDF invalide (logo)");
  console.log("OK : génération PDF vérifiée");
}

main().catch((error) => {
  console.error("ÉCHEC", error);
  process.exit(1);
});
