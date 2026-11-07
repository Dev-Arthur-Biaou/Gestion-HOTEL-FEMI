import { fail, guard } from "@/lib/api";
import { allPayments, clientsOverview, listStays } from "@/lib/stays";
import { todayISO } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/money";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = String(value ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export async function GET(request: Request) {
  try {
    await guard();
    const type = new URL(request.url).searchParams.get("type") ?? "stays";
    let csv = "";
    let name = "sejours";

    if (type === "payments") {
      const rows = await allPayments();
      name = "paiements";
      csv = toCsv(
        ["Date", "Document", "Client", "Type", "Montant (FCFA)", "Moyen", "Référence", "Note"],
        rows.map((p) => [
          p.paidOn,
          p.stayNumber,
          p.clientName,
          p.kind === "remboursement" ? "Remboursement" : "Paiement",
          p.kind === "remboursement" ? -p.amount : p.amount,
          p.method,
          p.reference,
          p.note,
        ]),
      );
    } else if (type === "clients") {
      const rows = await clientsOverview();
      name = "clients";
      csv = toCsv(
        ["Nom", "Téléphone", "E-mail", "Adresse", "IFU", "Séjours", "Solde dû (FCFA)"],
        rows.map((c) => [c.name, c.phone, c.email, c.address, c.ifu, c.stayCount, c.totalBalance]),
      );
    } else {
      const rows = await listStays({ sort: "arrivee", dir: "desc" });
      csv = toCsv(
        [
          "Identifiant interne",
          "Statut",
          "Client",
          "Téléphone",
          "Chambre",
          "Arrivée",
          "Départ",
          "Nuits",
          "Prix/nuit",
          "Hébergement",
          "Services",
          "Remise",
          "Frais",
          "Taxe",
          "Total",
          "Reçu",
          "Solde dû",
          "Trop-perçu",
        ],
        rows.map((s) => [
          s.number,
          STATUS_LABEL[s.status],
          s.client.name,
          s.client.phone,
          s.roomLabel,
          `${s.arrivalDate} ${s.arrivalTime}`,
          `${s.departureDate} ${s.departureTime}`,
          s.nights,
          s.nightlyRate,
          s.totals.hebergement,
          s.totals.servicesTotal,
          s.totals.remise,
          s.totals.fraisTotal,
          s.totals.taxe,
          s.totals.total,
          s.balance.net,
          s.balance.solde,
          s.balance.tropPercu,
        ]),
      );
    }

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Hotel-Femi-${name}-${todayISO()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
