import type { jsPDF } from "jspdf";
import { frDate } from "@/lib/dates";
import {
  INTERNAL_NOTICE,
  STATUS_LABEL,
  formatMoney,
  lineAmount,
  pdfText,
  slugify,
} from "@/lib/money";
import type { SettingsDTO, StayDTO } from "@/lib/types";

const NUIT: [number, number, number] = [14, 51, 43];
const TERRE: [number, number, number] = [191, 81, 39];
const INK: [number, number, number] = [29, 26, 21];
const MUTED: [number, number, number] = [120, 109, 92];
const SAND: [number, number, number] = [243, 237, 226];

type WithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function pdfFilename(stay: StayDTO): string {
  return `Hotel-Femi-Sejour-${stay.number}-${slugify(stay.client.name)}.pdf`;
}

export async function generateStayPdf(stay: StayDTO, settings: SettingsDTO): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true }) as WithTable;
  const M = 14;
  const W = 210 - M * 2;
  let y = M;

  const money = (value: number) => pdfText(formatMoney(value));

  // --- Identité de l'hôtel
  if (settings.logo) {
    try {
      const type = settings.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(settings.logo, type, M, y, 20, 20, undefined, "FAST");
    } catch {
      /* logo illisible : on continue sans image */
    }
  }
  const textX = settings.logo ? M + 24 : M;
  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...NUIT);
  doc.text(pdfText(settings.hotelName), textX, y + 7);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const info = [
    settings.address || "Adresse : non renseignée",
    `${settings.phone ? `Tél. ${settings.phone}` : "Téléphone : non renseigné"}${settings.email ? ` · ${settings.email}` : ""}`,
    "Bénin · Devise : FCFA (XOF)",
  ];
  info.forEach((line, i) => doc.text(pdfText(line), textX, y + 12.5 + i * 4));

  // --- Encadré document
  const boxW = 62;
  const boxX = 210 - M - boxW;
  doc.setDrawColor(207, 191, 164).setFillColor(255, 248, 238);
  doc.roundedRect(boxX, y, boxW, 28, 2, 2, "FD");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...MUTED);
  doc.text("DOCUMENT INTERNE DE SÉJOUR", boxX + 4, y + 6);
  doc.setFontSize(13).setTextColor(...TERRE);
  doc.text(stay.number, boxX + 4, y + 13);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
  const preparedLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(stay.preparedAt ?? stay.createdAt));
  doc.text(pdfText(`Préparé le ${preparedLabel}`), boxX + 4, y + 19);
  doc.setFont("helvetica", "bold").setTextColor(...INK);
  doc.text(pdfText(`Statut : ${STATUS_LABEL[stay.status]}`), boxX + 4, y + 24.5);

  y += 33;

  // --- Mention obligatoire
  doc.setDrawColor(221, 161, 24).setFillColor(253, 244, 219);
  doc.roundedRect(M, y, W, 9, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8.4).setTextColor(122, 86, 2);
  doc.text(pdfText(INTERNAL_NOTICE), M + 3, y + 5.8);
  y += 12;

  if (stay.status === "annule") {
    doc.setDrawColor(191, 58, 43).setFillColor(252, 235, 233);
    doc.roundedRect(M, y, W, 9, 1.5, 1.5, "FD");
    doc.setTextColor(191, 58, 43);
    doc.text(pdfText(`DOCUMENT ANNULÉ — ${stay.cancelReason || "sans motif précisé"}`), M + 3, y + 5.8);
    y += 12;
  }

  // --- Blocs client / séjour
  const colW = (W - 5) / 2;
  const blockTop = y;
  doc.setDrawColor(226, 216, 198).setFillColor(255, 255, 255);
  doc.roundedRect(M, blockTop, colW, 34, 2, 2, "D");
  doc.roundedRect(M + colW + 5, blockTop, colW, 34, 2, 2, "D");

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...MUTED);
  doc.text("CLIENT", M + 4, blockTop + 6);
  doc.text("SÉJOUR", M + colW + 9, blockTop + 6);

  doc.setFontSize(11).setTextColor(...INK);
  doc.text(pdfText(stay.client.name), M + 4, blockTop + 12, { maxWidth: colW - 8 });
  doc.setFont("helvetica", "normal").setFontSize(8.3).setTextColor(...MUTED);
  const clientLines = [
    stay.client.phone ? `Tél. ${stay.client.phone}` : "",
    stay.client.email,
    stay.client.address,
    stay.client.billingInfo,
    stay.client.ifu ? `IFU client : ${stay.client.ifu}` : "",
  ].filter(Boolean) as string[];
  (clientLines.length ? clientLines : ["Coordonnées non renseignées"])
    .slice(0, 4)
    .forEach((line, i) =>
      doc.text(pdfText(line), M + 4, blockTop + 17.5 + i * 4, { maxWidth: colW - 8 }),
    );

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
  doc.text(pdfText(stay.roomLabel || "Chambre non précisée"), M + colW + 9, blockTop + 12, {
    maxWidth: colW - 8,
  });
  doc.setFont("helvetica", "normal").setFontSize(8.3).setTextColor(...MUTED);
  [
    `Arrivée : ${frDate(stay.arrivalDate)} · ${stay.arrivalTime}`,
    `Départ : ${frDate(stay.departureDate)} · ${stay.departureTime}`,
    `${stay.nights} nuit(s) · ${stay.roomCount} chambre(s) · ${stay.guestCount} client(s)`,
  ].forEach((line, i) => doc.text(pdfText(line), M + colW + 9, blockTop + 17.5 + i * 4));

  y = blockTop + 40;

  // --- Lignes du séjour
  const body: string[][] = [
    [
      `Hébergement — ${stay.roomLabel || "chambre"}\n${frDate(stay.arrivalDate)} → ${frDate(stay.departureDate)}`,
      String(stay.nights * stay.roomCount),
      money(stay.nightlyRate),
      money(stay.totals.hebergement),
    ],
    ...stay.services.map((service) => [
      `${service.description}\n${service.category}`,
      String(service.quantity),
      money(service.unitPrice),
      money(lineAmount(service)),
    ]),
  ];
  if (stay.services.length === 0) {
    body.push(["Aucun service supplémentaire facturé sur ce séjour.", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Désignation", "Qté", "Prix unitaire", "Montant"]],
    body: body.map((row) => row.map(pdfText)),
    theme: "grid",
    margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8.6, cellPadding: 2.2, textColor: INK, lineColor: [226, 216, 198], lineWidth: 0.15 },
    headStyles: { fillColor: NUIT, textColor: [253, 246, 232], fontStyle: "bold", fontSize: 8.6 },
    alternateRowStyles: { fillColor: [255, 252, 247] },
    columnStyles: {
      0: { cellWidth: W - 78 },
      1: { cellWidth: 16, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  // --- Totaux
  const totalsLines: [string, string][] = [
    ["Hébergement", money(stay.totals.hebergement)],
    ["Services supplémentaires", money(stay.totals.servicesTotal)],
  ];
  if (stay.totals.remise > 0) totalsLines.push(["Remise", `− ${money(stay.totals.remise)}`]);
  const base = stay.totals.hebergement + stay.totals.servicesTotal - stay.totals.remise;
  for (const fee of stay.fees) {
    totalsLines.push([
      `${fee.label}${fee.mode === "pourcentage" ? ` (${fee.value} %)` : ""}`,
      money(fee.mode === "pourcentage" ? Math.round((base * fee.value) / 100) : fee.value),
    ]);
  }
  totalsLines.push(["Sous-total", money(stay.totals.sousTotal)]);
  if (stay.totals.taxe > 0) {
    totalsLines.push([`${stay.taxLabel || "Taxe"} (${stay.taxRate} %)`, money(stay.totals.taxe)]);
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = M;
    }
  };

  ensureSpace(totalsLines.length * 5 + 16);
  const totalsX = 210 - M - 84;
  doc.setFontSize(9);
  totalsLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal").setTextColor(...MUTED);
    doc.text(pdfText(label), totalsX, y);
    doc.setFont("helvetica", "bold").setTextColor(...INK);
    doc.text(pdfText(value), 210 - M, y, { align: "right" });
    y += 5;
  });
  y += 1;
  doc.setFillColor(...NUIT);
  doc.roundedRect(totalsX - 3, y - 4.5, 87, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(253, 246, 232);
  doc.text("TOTAL À PAYER", totalsX, y + 2);
  doc.text(money(stay.totals.total), 210 - M, y + 2, { align: "right" });
  y += 14;

  // --- Paiements
  ensureSpace(30);
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
  doc.text("ACOMPTES ET PAIEMENTS", M, y);
  y += 3;

  if (stay.payments.length === 0) {
    doc.setDrawColor(207, 191, 164);
    doc.setLineDashPattern([1, 1], 0);
    doc.roundedRect(M, y, W, 10, 1.5, 1.5, "D");
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
    doc.text("Aucun paiement enregistré à ce jour.", M + 3, y + 6.3);
    y += 14;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Moyen", "Référence / note", "Montant"]],
      body: stay.payments.map((p) => [
        frDate(p.paidOn, "short"),
        `${p.method}${p.kind === "remboursement" ? " (remboursement)" : ""}`,
        pdfText([p.reference, p.note].filter(Boolean).join(" · ") || "—"),
        `${p.kind === "remboursement" ? "− " : ""}${money(p.amount)}`,
      ]),
      theme: "grid",
      margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 8.3, cellPadding: 2, textColor: INK, lineColor: [226, 216, 198], lineWidth: 0.15 },
      headStyles: { fillColor: SAND, textColor: MUTED, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 40 },
        3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  ensureSpace(26);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text("Total reçu", totalsX, y);
  doc.setFont("helvetica", "bold").setTextColor(...INK);
  doc.text(money(stay.balance.recu), 210 - M, y, { align: "right" });
  y += 5;
  if (stay.balance.rembourse > 0) {
    doc.setFont("helvetica", "normal").setTextColor(...MUTED);
    doc.text("Remboursé au client", totalsX, y);
    doc.setFont("helvetica", "bold").setTextColor(...INK);
    doc.text(`− ${money(stay.balance.rembourse)}`, 210 - M, y, { align: "right" });
    y += 5;
  }
  y += 1;
  const solde = stay.balance.tropPercu > 0 ? stay.balance.tropPercu : stay.balance.solde;
  const soldeLabel =
    stay.balance.tropPercu > 0
      ? "MONTANT REMBOURSABLE"
      : stay.balance.solde > 0
        ? "SOLDE RESTANT DÛ"
        : "SÉJOUR SOLDÉ";
  const soldeColor: [number, number, number] = stay.balance.solde > 0 ? TERRE : [22, 130, 93];
  doc.setDrawColor(...soldeColor);
  doc.setFillColor(
    stay.balance.solde > 0 ? 253 : 233,
    stay.balance.solde > 0 ? 240 : 246,
    stay.balance.solde > 0 ? 234 : 240,
  );
  doc.roundedRect(totalsX - 3, y - 4.5, 87, 10, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...soldeColor);
  doc.text(soldeLabel, totalsX, y + 2);
  doc.text(money(solde), 210 - M, y + 2, { align: "right" });
  y += 14;

  // --- Coordonnées de paiement
  if (settings.paymentInfo || settings.momoDetails || settings.bankDetails) {
    const lines = [
      settings.paymentInfo,
      settings.momoDetails ? `Mobile Money : ${settings.momoDetails}` : "",
      settings.bankDetails ? `Banque : ${settings.bankDetails}` : "",
    ].filter(Boolean) as string[];
    const wrapped = lines.flatMap((line) => doc.splitTextToSize(pdfText(line), W - 8) as string[]);
    ensureSpace(wrapped.length * 4 + 12);
    doc.setDrawColor(226, 216, 198);
    doc.roundedRect(M, y, W, wrapped.length * 4 + 10, 2, 2, "D");
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...NUIT);
    doc.text("Coordonnées de paiement", M + 4, y + 6);
    doc.setFont("helvetica", "normal").setFontSize(8.2).setTextColor(...MUTED);
    wrapped.forEach((line, i) => doc.text(line, M + 4, y + 11 + i * 4));
    y += wrapped.length * 4 + 14;
  }

  // --- Pied de page sur chaque page
  const footerLines = [
    settings.commercialNotes,
    settings.footerText,
    `Numérotation interne ${stay.number} — attribuée par le logiciel de l'hôtel, sans valeur fiscale. Si une facture normalisée doit être délivrée, elle doit être émise avec la solution officielle ou autorisée applicable (DGI Bénin).`,
  ].filter(Boolean) as string[];

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    let fy = 270;
    doc.setDrawColor(226, 216, 198);
    doc.line(M, fy - 4, 210 - M, fy - 4);
    doc.setFont("helvetica", "normal").setFontSize(7);
    if (page === pages) {
      const wrapped = footerLines.flatMap((line) => doc.splitTextToSize(pdfText(line), W - 24) as string[]);
      const start = fy - Math.min(4, wrapped.length) * 3.2;
      wrapped.slice(0, 5).forEach((line, i) => {
        doc.setTextColor(...MUTED);
        doc.text(line, M, start + i * 3.2);
      });
      fy = start + Math.min(5, wrapped.length) * 3.2 + 2;
    }
    doc.setTextColor(...MUTED);
    doc.text(pdfText(`${settings.hotelName} · ${stay.number} · ${stay.client.name}`), M, 288);
    doc.text(`Page ${page} / ${pages}`, 210 - M, 288, { align: "right" });
  }

  return doc.output("blob");
}
