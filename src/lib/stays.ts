import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  payments,
  settings,
  stayEvents,
  stayServices,
  stays,
  type Client,
  type Settings,
} from "@/db/schema";
import { ApiError, optionalString, positiveInt, requiredString } from "@/lib/api";
import { isISODate, isTime, nightsBetween, todayISO } from "@/lib/dates";
import { computeBalance, computeTotals, num, statusOf, type Fee, type ServiceLine } from "@/lib/money";
import { nextDocumentNumber } from "@/lib/seed";
import type {
  ClientDTO,
  DashboardDTO,
  PaymentDTO,
  SettingsDTO,
  StayDTO,
  StayInput,
} from "@/lib/types";

export function toSettingsDTO(row: Settings): SettingsDTO {
  return {
    hotelName: row.hotelName,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logo: row.logo,
    paymentInfo: row.paymentInfo,
    currency: row.currency,
    footerText: row.footerText,
    commercialNotes: row.commercialNotes,
    bankDetails: row.bankDetails,
    momoDetails: row.momoDetails,
    docPrefix: row.docPrefix,
    taxLabel: row.taxLabel,
    taxRate: num(row.taxRate),
    extraFees: row.extraFees ?? [],
    serviceCategories: row.serviceCategories ?? [],
    paymentMethods: row.paymentMethods ?? [],
    defaultNightlyRate: row.defaultNightlyRate,
  };
}

export async function getSettings(): Promise<SettingsDTO> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!rows[0]) throw new ApiError("Paramètres de l'hôtel introuvables.", 500);
  return toSettingsDTO(rows[0]);
}

export function toClientDTO(row: Client): ClientDTO {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    billingInfo: row.billingInfo,
    ifu: row.ifu,
    notes: row.notes,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPaymentDTO(row: typeof payments.$inferSelect): PaymentDTO {
  return {
    id: row.id,
    stayId: row.stayId,
    kind: row.kind === "remboursement" ? "remboursement" : "paiement",
    paidOn: row.paidOn,
    amount: row.amount,
    method: row.method,
    reference: row.reference,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    isDemo: row.isDemo,
  };
}

export type ListFilters = {
  id?: number;
  q?: string;
  status?: string;
  dateField?: string;
  from?: string;
  to?: string;
  clientId?: number;
  sort?: string;
  dir?: string;
  unpaidOnly?: boolean;
};

export async function listStays(filters: ListFilters = {}, withEvents = false): Promise<StayDTO[]> {
  const conditions = [];
  if (filters.id) conditions.push(eq(stays.id, filters.id));
  if (filters.clientId) conditions.push(eq(stays.clientId, filters.clientId));
  if (filters.from && isISODate(filters.from)) {
    conditions.push(
      gte(filters.dateField === "depart" ? stays.departureDate : stays.arrivalDate, filters.from),
    );
  }
  if (filters.to && isISODate(filters.to)) {
    conditions.push(
      lte(filters.dateField === "depart" ? stays.departureDate : stays.arrivalDate, filters.to),
    );
  }

  const rows = await db
    .select({ stay: stays, client: clients })
    .from(stays)
    .innerJoin(clients, eq(clients.id, stays.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stays.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.stay.id);
  const [serviceRows, paymentRows, eventRows] = await Promise.all([
    db.select().from(stayServices).where(inArray(stayServices.stayId, ids)),
    db.select().from(payments).where(inArray(payments.stayId, ids)),
    withEvents
      ? db.select().from(stayEvents).where(inArray(stayEvents.stayId, ids))
      : Promise.resolve([]),
  ]);

  let result: StayDTO[] = rows.map(({ stay, client }) => {
    const services = serviceRows
      .filter((s) => s.stayId === stay.id)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        category: s.category,
        description: s.description,
        quantity: num(s.quantity),
        unitPrice: s.unitPrice,
      }));
    const stayPayments = paymentRows
      .filter((p) => p.stayId === stay.id)
      .sort((a, b) => (a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : a.id - b.id))
      .map(toPaymentDTO);
    const totals = computeTotals({
      nights: stay.nights,
      nightlyRate: stay.nightlyRate,
      roomCount: stay.roomCount,
      services,
      discountMode: stay.discountMode,
      discountValue: num(stay.discountValue),
      fees: stay.fees ?? [],
      taxRate: num(stay.taxRate),
    });
    const balance = computeBalance(totals.total, stayPayments);
    return {
      id: stay.id,
      number: stay.number,
      client: toClientDTO(client),
      roomLabel: stay.roomLabel,
      arrivalDate: stay.arrivalDate,
      arrivalTime: stay.arrivalTime,
      departureDate: stay.departureDate,
      departureTime: stay.departureTime,
      nights: stay.nights,
      nightlyRate: stay.nightlyRate,
      roomCount: stay.roomCount,
      guestCount: stay.guestCount,
      discountMode: stay.discountMode,
      discountValue: num(stay.discountValue),
      fees: stay.fees ?? [],
      taxLabel: stay.taxLabel,
      taxRate: num(stay.taxRate),
      notes: stay.notes,
      lifecycle: stay.lifecycle,
      status: statusOf(stay.lifecycle, totals.total, balance.net),
      services,
      payments: stayPayments,
      events: withEvents
        ? eventRows
            .filter((e) => e.stayId === stay.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((e) => ({
              id: e.id,
              kind: e.kind,
              message: e.message,
              createdAt: e.createdAt.toISOString(),
            }))
        : undefined,
      totals,
      balance,
      preparedAt: stay.preparedAt ? stay.preparedAt.toISOString() : null,
      cancelledAt: stay.cancelledAt ? stay.cancelledAt.toISOString() : null,
      cancelReason: stay.cancelReason,
      isDemo: stay.isDemo,
      createdAt: stay.createdAt.toISOString(),
      updatedAt: stay.updatedAt.toISOString(),
    };
  });

  const q = (filters.q || "").trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, "");
    result = result.filter(
      (s) =>
        s.client.name.toLowerCase().includes(q) ||
        s.number.toLowerCase().includes(q) ||
        s.roomLabel.toLowerCase().includes(q) ||
        (digits.length >= 3 && s.client.phone.replace(/\D/g, "").includes(digits)),
    );
  }
  if (filters.status && filters.status !== "tous") {
    result = result.filter((s) => s.status === filters.status);
  }
  if (filters.unpaidOnly) {
    result = result.filter((s) => s.status !== "annule" && s.balance.solde > 0);
  }

  const dir = filters.dir === "asc" ? 1 : -1;
  const sort = filters.sort || "recent";
  result.sort((a, b) => {
    switch (sort) {
      case "arrivee":
        return a.arrivalDate < b.arrivalDate ? -dir : a.arrivalDate > b.arrivalDate ? dir : 0;
      case "depart":
        return a.departureDate < b.departureDate ? -dir : a.departureDate > b.departureDate ? dir : 0;
      case "montant":
        return (a.totals.total - b.totals.total) * dir;
      case "solde":
        return (a.balance.solde - b.balance.solde) * dir;
      case "client":
        return a.client.name.localeCompare(b.client.name, "fr") * dir;
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });
  return result;
}

export async function getStay(id: number): Promise<StayDTO> {
  const rows = await listStays({ id }, true);
  const found = rows[0];
  if (!found) throw new ApiError("Dossier introuvable : ce séjour n'existe pas ou a été supprimé.", 404);
  return found;
}

function validateStayInput(input: StayInput) {
  if (!isISODate(input.arrivalDate)) throw new ApiError("Date d'arrivée invalide.");
  if (!isISODate(input.departureDate)) throw new ApiError("Date de départ invalide.");
  if (!isTime(input.arrivalTime) || !isTime(input.departureTime)) {
    throw new ApiError("Heure d'arrivée ou de départ invalide (format 24 h, ex. 14:00).");
  }
  const nights = nightsBetween(input.arrivalDate, input.departureDate);
  if (nights < 1) {
    throw new ApiError(
      "La date de départ doit être postérieure à la date d'arrivée (au moins 1 nuit).",
    );
  }
  const nightlyRate = positiveInt(input.nightlyRate, "prix par nuit");
  const roomCount = positiveInt(input.roomCount, "nombre de chambres", { min: 1, max: 100 });
  const guestCount = positiveInt(input.guestCount, "nombre de clients", { min: 1, max: 100 });
  const discountValue = num(input.discountValue);
  if (discountValue < 0 || (input.discountMode === "pourcentage" && discountValue > 100)) {
    throw new ApiError("Remise invalide : montant négatif ou pourcentage supérieur à 100.");
  }
  const taxRate = num(input.taxRate);
  if (taxRate < 0 || taxRate > 100) throw new ApiError("Taux de taxe invalide (0 à 100).");
  const services: ServiceLine[] = (input.services || [])
    .filter((s) => (s.description || "").trim() !== "" || num(s.unitPrice) > 0)
    .map((s, index) => {
      const quantity = num(s.quantity);
      const unitPrice = num(s.unitPrice);
      if (quantity <= 0) throw new ApiError(`Quantité invalide pour la ligne ${index + 1}.`);
      if (unitPrice < 0) throw new ApiError(`Prix unitaire invalide pour la ligne ${index + 1}.`);
      return {
        category: optionalString(s.category, 60) || "Autre",
        description: requiredString(s.description, `description de la ligne ${index + 1}`, 200),
        quantity,
        unitPrice: Math.round(unitPrice),
      };
    });
  const fees: Fee[] = (input.fees || [])
    .filter((f) => (f.label || "").trim() !== "" && num(f.value) !== 0)
    .map((f) => ({
      label: optionalString(f.label, 80),
      mode: f.mode === "pourcentage" ? "pourcentage" : "fixe",
      value: num(f.value),
    }));

  return {
    nights,
    nightlyRate,
    roomCount,
    guestCount,
    discountValue,
    taxRate,
    services,
    fees,
  };
}

export async function createStay(input: StayInput): Promise<StayDTO> {
  const clean = validateStayInput(input);
  let clientId = input.clientId ?? null;
  if (!clientId) {
    const name = requiredString(input.client?.name, "nom du client");
    const [row] = await db
      .insert(clients)
      .values({
        name,
        phone: optionalString(input.client?.phone, 60),
        email: optionalString(input.client?.email, 120),
        address: optionalString(input.client?.address, 300),
        billingInfo: optionalString(input.client?.billingInfo, 500),
        ifu: optionalString(input.client?.ifu, 40),
      })
      .returning({ id: clients.id });
    clientId = row.id;
  } else {
    const exists = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
    if (!exists.length) throw new ApiError("Client introuvable.", 404);
  }

  const config = await getSettings();
  const year = Number(todayISO().slice(0, 4));
  const number = await nextDocumentNumber(config.docPrefix || "HF", year);
  const lifecycle = input.lifecycle === "prepare" ? "prepare" : "brouillon";

  const [row] = await db
    .insert(stays)
    .values({
      number,
      clientId,
      roomLabel: optionalString(input.roomLabel, 120),
      arrivalDate: input.arrivalDate,
      arrivalTime: input.arrivalTime,
      departureDate: input.departureDate,
      departureTime: input.departureTime,
      nights: clean.nights,
      nightlyRate: clean.nightlyRate,
      roomCount: clean.roomCount,
      guestCount: clean.guestCount,
      discountMode: input.discountMode === "pourcentage" ? "pourcentage" : "montant",
      discountValue: String(clean.discountValue),
      fees: clean.fees,
      taxLabel: optionalString(input.taxLabel, 80),
      taxRate: String(clean.taxRate),
      notes: optionalString(input.notes, 1000),
      lifecycle,
      preparedAt: lifecycle === "prepare" ? new Date() : null,
    })
    .returning({ id: stays.id });

  if (clean.services.length) {
    await db.insert(stayServices).values(
      clean.services.map((s, position) => ({
        stayId: row.id,
        category: s.category,
        description: s.description,
        quantity: String(s.quantity),
        unitPrice: s.unitPrice,
        position,
      })),
    );
  }
  await addEvent(
    row.id,
    "creation",
    `Document interne ${number} créé — ${clean.nights} nuit(s).`,
  );
  if (lifecycle === "prepare") await addEvent(row.id, "preparation", "Document marqué comme préparé.");
  return getStay(row.id);
}

export async function updateStay(id: number, input: StayInput): Promise<StayDTO> {
  const current = await getStay(id);
  if (current.lifecycle === "annule") {
    throw new ApiError("Ce document est annulé : réactivez-le avant de le modifier.");
  }
  const clean = validateStayInput(input);
  await db
    .update(stays)
    .set({
      roomLabel: optionalString(input.roomLabel, 120),
      arrivalDate: input.arrivalDate,
      arrivalTime: input.arrivalTime,
      departureDate: input.departureDate,
      departureTime: input.departureTime,
      nights: clean.nights,
      nightlyRate: clean.nightlyRate,
      roomCount: clean.roomCount,
      guestCount: clean.guestCount,
      discountMode: input.discountMode === "pourcentage" ? "pourcentage" : "montant",
      discountValue: String(clean.discountValue),
      fees: clean.fees,
      taxLabel: optionalString(input.taxLabel, 80),
      taxRate: String(clean.taxRate),
      notes: optionalString(input.notes, 1000),
      updatedAt: new Date(),
    })
    .where(eq(stays.id, id));

  await db.delete(stayServices).where(eq(stayServices.stayId, id));
  if (clean.services.length) {
    await db.insert(stayServices).values(
      clean.services.map((s, position) => ({
        stayId: id,
        category: s.category,
        description: s.description,
        quantity: String(s.quantity),
        unitPrice: s.unitPrice,
        position,
      })),
    );
  }
  await addEvent(id, "modification", `Détails du séjour mis à jour (${clean.nights} nuit(s)).`);
  return getStay(id);
}

export async function addEvent(stayId: number, kind: string, message: string) {
  await db.insert(stayEvents).values({ stayId, kind, message });
}

export async function buildDashboard(): Promise<DashboardDTO> {
  const today = todayISO();
  const config = await getSettings();
  const all = await listStays({ sort: "recent" });
  const active = all.filter((s) => s.status !== "annule");
  const monthStart = `${today.slice(0, 7)}-01`;

  const paymentRows = await db
    .select()
    .from(payments)
    .where(gte(payments.paidOn, addDaysLocal(today, -27)));
  const activeIds = new Set(active.map((s) => s.id));
  const validPayments = paymentRows.filter((p) => activeIds.has(p.stayId));

  const cashflowMap = new Map<string, number>();
  for (let i = 13; i >= 0; i -= 1) cashflowMap.set(addDaysLocal(today, -i), 0);
  for (const p of validPayments) {
    if (cashflowMap.has(p.paidOn)) {
      const sign = p.kind === "remboursement" ? -1 : 1;
      cashflowMap.set(p.paidOn, (cashflowMap.get(p.paidOn) || 0) + sign * p.amount);
    }
  }
  const methodMap = new Map<string, number>();
  for (const p of validPayments.filter((p) => p.paidOn >= monthStart && p.kind !== "remboursement")) {
    methodMap.set(p.method, (methodMap.get(p.method) || 0) + p.amount);
  }

  const missing: string[] = [];
  if (!config.address) missing.push("Adresse de l'hôtel");
  if (!config.phone) missing.push("Téléphone de l'hôtel");
  if (!config.email) missing.push("E-mail de l'hôtel");
  if (!config.logo) missing.push("Logo (facultatif)");
  if (!config.footerText) missing.push("Texte de pied de page");
  if (!config.paymentInfo && !config.momoDetails && !config.bankDetails) {
    missing.push("Coordonnées de paiement");
  }

  return {
    today,
    arrivals: active
      .filter((s) => s.arrivalDate === today)
      .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)),
    departures: active
      .filter((s) => s.departureDate === today)
      .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)),
    inHouse: active.filter((s) => s.arrivalDate <= today && s.departureDate > today),
    recent: all.slice(0, 6),
    unpaid: active
      .filter((s) => s.balance.solde > 0)
      .sort((a, b) => b.balance.solde - a.balance.solde)
      .slice(0, 8),
    totals: {
      encaisseJour: validPayments
        .filter((p) => p.paidOn === today)
        .reduce((sum, p) => sum + (p.kind === "remboursement" ? -p.amount : p.amount), 0),
      encaisseMois: validPayments
        .filter((p) => p.paidOn >= monthStart)
        .reduce((sum, p) => sum + (p.kind === "remboursement" ? -p.amount : p.amount), 0),
      soldeTotal: active.reduce((sum, s) => sum + s.balance.solde, 0),
      documentsOuverts: active.filter((s) => s.status !== "paye").length,
      brouillons: active.filter((s) => s.status === "brouillon").length,
      tropPercu: active.reduce((sum, s) => sum + s.balance.tropPercu, 0),
      nuitsMois: active
        .filter((s) => s.arrivalDate >= monthStart)
        .reduce((sum, s) => sum + s.nights * s.roomCount, 0),
    },
    cashflow: [...cashflowMap.entries()].map(([date, amount]) => ({ date, amount })),
    methods: [...methodMap.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    missingSettings: missing,
  };
}

function addDaysLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function clientsOverview() {
  const [rows, stayRows] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    listStays({}),
  ]);
  return rows
    .map((row) => {
      const own = stayRows.filter((s) => s.client.id === row.id && s.status !== "annule");
      return {
        ...toClientDTO(row),
        stayCount: own.length,
        totalBalance: own.reduce((sum, s) => sum + s.balance.solde, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function allPayments(): Promise<PaymentDTO[]> {
  const rows = await db
    .select({ payment: payments, stay: stays, client: clients })
    .from(payments)
    .innerJoin(stays, eq(stays.id, payments.stayId))
    .innerJoin(clients, eq(clients.id, stays.clientId))
    .orderBy(desc(payments.paidOn), desc(payments.id));
  return rows.map(({ payment, stay, client }) => ({
    ...toPaymentDTO(payment),
    stayNumber: stay.number,
    clientName: client.name,
  }));
}


