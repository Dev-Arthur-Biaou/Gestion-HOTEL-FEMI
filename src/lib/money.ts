export type FeeMode = "fixe" | "pourcentage";
export type Fee = { label: string; mode: FeeMode; value: number };

export type ServiceLine = {
  id?: number;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type TotalsInput = {
  nights: number;
  nightlyRate: number;
  roomCount: number;
  services: ServiceLine[];
  discountMode: string;
  discountValue: number;
  fees: Fee[];
  taxRate: number;
};

export type Totals = {
  hebergement: number;
  servicesTotal: number;
  remise: number;
  fraisTotal: number;
  sousTotal: number;
  taxe: number;
  total: number;
};

export type Balance = {
  recu: number;
  rembourse: number;
  net: number;
  solde: number;
  tropPercu: number;
};

export type StayStatus = "brouillon" | "prepare" | "partiel" | "paye" | "annule";

/** Tout est arrondi au franc CFA près (XOF : pas de centimes). */
export function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function lineAmount(line: ServiceLine): number {
  return round(num(line.quantity) * num(line.unitPrice));
}

export function feeAmount(fee: Fee, base: number): number {
  if (fee.mode === "pourcentage") return round((base * num(fee.value)) / 100);
  return round(num(fee.value));
}

export function computeTotals(input: TotalsInput): Totals {
  const nights = Math.max(0, Math.trunc(num(input.nights)));
  const rooms = Math.max(1, Math.trunc(num(input.roomCount, 1)));
  const hebergement = round(nights * num(input.nightlyRate) * rooms);
  const servicesTotal = (input.services || []).reduce((sum, l) => sum + lineAmount(l), 0);
  const brut = hebergement + servicesTotal;
  const remise =
    input.discountMode === "pourcentage"
      ? Math.min(brut, round((brut * num(input.discountValue)) / 100))
      : Math.min(brut, Math.max(0, round(num(input.discountValue))));
  const apresRemise = brut - remise;
  const fraisTotal = (input.fees || [])
    .filter((f) => (f.label || "").trim() !== "" || num(f.value) !== 0)
    .reduce((sum, f) => sum + feeAmount(f, apresRemise), 0);
  const sousTotal = apresRemise + fraisTotal;
  const taxe = round((sousTotal * num(input.taxRate)) / 100);
  return {
    hebergement,
    servicesTotal,
    remise,
    fraisTotal,
    sousTotal,
    taxe,
    total: sousTotal + taxe,
  };
}

export function computeBalance(
  total: number,
  payments: { kind: string; amount: number }[],
): Balance {
  let recu = 0;
  let rembourse = 0;
  for (const p of payments || []) {
    if (p.kind === "remboursement") rembourse += round(num(p.amount));
    else recu += round(num(p.amount));
  }
  const net = recu - rembourse;
  const diff = round(total) - net;
  return {
    recu,
    rembourse,
    net,
    solde: Math.max(0, diff),
    tropPercu: Math.max(0, -diff),
  };
}

export function statusOf(lifecycle: string, total: number, net: number): StayStatus {
  if (lifecycle === "annule") return "annule";
  if (lifecycle === "brouillon") return "brouillon";
  if (net > 0 && net >= round(total)) return "paye";
  if (net > 0) return "partiel";
  return "prepare";
}

export const STATUS_LABEL: Record<StayStatus, string> = {
  brouillon: "Brouillon",
  prepare: "Préparé",
  partiel: "Partiellement payé",
  paye: "Payé en totalité",
  annule: "Annulé",
};

export const INTERNAL_NOTICE =
  "Document interne de préparation et de suivi — ne vaut pas facture normalisée.";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatMoney(value: number): string {
  return `${nf.format(round(value))} FCFA`;
}

export function formatNumber(value: number): string {
  return nf.format(round(value));
}

/** Les polices PDF standard ne gèrent pas les espaces fines : on normalise. */
export function pdfText(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "Client";
}
