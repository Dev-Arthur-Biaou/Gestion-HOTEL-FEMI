import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, payments, stayEvents, stayServices, stays } from "@/db/schema";
import { addDays, todayISO } from "@/lib/dates";
import { computeBalance, computeTotals } from "@/lib/money";

type DemoService = [string, string, number, number];
type DemoPayment = [number, number, string, string];

type DemoStay = {
  client: string;
  phone: string;
  email?: string;
  address?: string;
  billing?: string;
  room: string;
  from: number;
  to: number;
  rate: number;
  rooms?: number;
  guests?: number;
  services: DemoService[];
  pay: DemoPayment[];
  lifecycle: "brouillon" | "prepare" | "annule";
  discount?: number;
  notes?: string;
  cancelReason?: string;
};

const DEMO: DemoStay[] = [
  {
    client: "Rachidatou Bio",
    phone: "+229 01 97 42 18",
    email: "r.bio@example.bj",
    room: "Chambre 204 — Deluxe",
    from: -12,
    to: -9,
    rate: 27500,
    guests: 2,
    services: [
      ["Restauration", "Dîner poisson braisé", 4, 4500],
      ["Blanchisserie", "Chemises et pantalon", 3, 1000],
    ],
    pay: [[-12, 40000, "Espèces", "Acompte à l'arrivée"], [-9, 62500, "Mobile Money", "Solde au départ"]],
    lifecycle: "prepare",
  },
  {
    client: "Koffi Adjovi",
    phone: "+229 01 96 30 77",
    room: "Chambre 101 — Standard",
    from: -9,
    to: -6,
    rate: 15000,
    services: [["Boisson", "Eau minérale 1,5 L", 6, 500]],
    pay: [[-6, 48000, "Mobile Money", "MTN MoMo"]],
    lifecycle: "prepare",
  },
  {
    client: "Établissements Sika SARL",
    phone: "+229 01 95 11 04",
    email: "compta@sika-example.bj",
    billing: "Facturation au nom de la société — service achats",
    address: "Cotonou, Bénin",
    room: "Suite 301 — Séjour société",
    from: -7,
    to: -2,
    rate: 45000,
    rooms: 2,
    guests: 2,
    services: [
      ["Restauration", "Déjeuners séminaire (2 pers.)", 10, 5000],
      ["Transport", "Navette aéroport aller-retour", 2, 10000],
    ],
    pay: [[-7, 150000, "Virement", "Acompte 30 %"]],
    lifecycle: "prepare",
    notes: "Solde à régler par le service comptable sous 15 jours.",
  },
  {
    client: "Aline Hounkpatin",
    phone: "+229 01 97 88 52",
    room: "Chambre 202 — Deluxe",
    from: -5,
    to: -1,
    rate: 22000,
    services: [["Restauration", "Petit-déjeuner", 4, 2500]],
    pay: [[-5, 50000, "Carte", "TPE réception"], [-1, 53000, "Espèces", "Règlement départ"]],
    lifecycle: "prepare",
    notes: "Trop-perçu à restituer au client (à confirmer en caisse).",
  },
  {
    client: "Emmanuel Zinsou",
    phone: "+229 01 94 26 09",
    room: "Chambre 105 — Standard",
    from: -4,
    to: 0,
    rate: 18000,
    services: [["Blanchisserie", "Linge séjour long", 1, 4000]],
    pay: [[-4, 30000, "Espèces", "Acompte"]],
    lifecycle: "prepare",
  },
  {
    client: "Fatouma Alassane",
    phone: "+229 01 97 05 63",
    room: "Chambre 203 — Deluxe",
    from: -3,
    to: 0,
    rate: 22000,
    guests: 2,
    services: [["Boisson", "Jus de bissap", 5, 1000]],
    pay: [[-3, 71000, "Mobile Money", "Moov Money"]],
    lifecycle: "prepare",
  },
  {
    client: "ONG Bénin Avenir",
    phone: "+229 01 90 44 21",
    email: "mission@beninavenir-example.org",
    billing: "Mission atelier formation — 3 participants",
    room: "Chambres 301 & 302 — Mission",
    from: -2,
    to: 2,
    rate: 32000,
    rooms: 2,
    guests: 3,
    services: [
      ["Restauration", "Pause café atelier", 12, 1500],
      ["Autre", "Location salle de réunion (demi-journée)", 2, 25000],
    ],
    pay: [[-2, 100000, "Virement", "Acompte mission"]],
    lifecycle: "prepare",
  },
  {
    client: "Gilles Sossou",
    phone: "+229 01 96 72 30",
    room: "Chambre 102 — Standard",
    from: -1,
    to: 3,
    rate: 15000,
    services: [["Transport", "Navette Cotonou centre", 1, 7000]],
    pay: [],
    lifecycle: "prepare",
    notes: "Client habituel — règlement au départ.",
  },
  {
    client: "Mariam Chabi",
    phone: "+229 01 97 13 88",
    email: "mariam.chabi@example.bj",
    room: "Chambre 204 — Deluxe",
    from: 0,
    to: 2,
    rate: 27500,
    guests: 2,
    services: [["Restauration", "Dîner terrasse", 2, 6000]],
    pay: [[0, 30000, "Mobile Money", "Acompte réservation"]],
    lifecycle: "prepare",
  },
  {
    client: "Paul Agbodjan",
    phone: "+229 01 95 60 12",
    room: "Chambre 106 — Standard",
    from: 0,
    to: 1,
    rate: 18000,
    services: [],
    pay: [],
    lifecycle: "prepare",
  },
  {
    client: "Sandra Kpadonou",
    phone: "+229 01 97 39 45",
    room: "Chambre 201 — Deluxe",
    from: 1,
    to: 4,
    rate: 22000,
    services: [["Restauration", "Petit-déjeuner (prévu)", 3, 2500]],
    pay: [],
    lifecycle: "brouillon",
    notes: "Arrivée confirmée par téléphone, document à finaliser.",
  },
  {
    client: "Ibrahim Sékou",
    phone: "+229 01 94 87 26",
    email: "i.sekou@example.bj",
    room: "Suite 302",
    from: 3,
    to: 5,
    rate: 45000,
    guests: 2,
    services: [["Transport", "Navette aéroport", 1, 10000]],
    pay: [[-1, 50000, "Virement", "Acompte séjour"]],
    lifecycle: "prepare",
    discount: 5000,
  },
  {
    client: "Bénédicte Ahouandjinou",
    phone: "+229 01 96 55 71",
    room: "Chambre 103 — Standard",
    from: 5,
    to: 7,
    rate: 15000,
    services: [],
    pay: [],
    lifecycle: "brouillon",
  },
  {
    client: "Koffi Adjovi",
    phone: "+229 01 96 30 77",
    room: "Chambre 104 — Standard",
    from: -15,
    to: -13,
    rate: 15000,
    services: [],
    pay: [],
    lifecycle: "annule",
    cancelReason: "Erreur de saisie sur les dates — séjour ressaisi.",
  },
];

export async function nextDocumentNumber(prefix: string, year: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await db.execute(sql`
      INSERT INTO counters (year, last_value) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last_value = counters.last_value + 1
      RETURNING last_value
    `);
    const value = Number((result.rows[0] as { last_value: number }).last_value);
    const candidate = `${prefix}-${year}-${String(value).padStart(4, "0")}`;
    const clash = await db.select({ id: stays.id }).from(stays).where(eq(stays.number, candidate)).limit(1);
    if (clash.length === 0) return candidate;
  }
  throw new Error("Impossible d'attribuer un numéro interne disponible.");
}

export async function seedDemo(): Promise<{ created: number }> {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const clientIds = new Map<string, number>();
  let created = 0;

  for (const item of DEMO) {
    let clientId = clientIds.get(item.client);
    if (!clientId) {
      const [row] = await db
        .insert(clients)
        .values({
          name: item.client,
          phone: item.phone,
          email: item.email ?? "",
          address: item.address ?? "",
          billingInfo: item.billing ?? "",
          isDemo: true,
        })
        .returning({ id: clients.id });
      clientId = row.id;
      clientIds.set(item.client, clientId);
    }

    const arrivalDate = addDays(today, item.from);
    const departureDate = addDays(today, item.to);
    const nights = Math.max(1, item.to - item.from);
    const services = item.services.map(([category, description, quantity, unitPrice]) => ({
      category,
      description,
      quantity: String(quantity),
      unitPrice,
    }));
    const totals = computeTotals({
      nights,
      nightlyRate: item.rate,
      roomCount: item.rooms ?? 1,
      services: item.services.map(([category, description, quantity, unitPrice]) => ({
        category,
        description,
        quantity,
        unitPrice,
      })),
      discountMode: "montant",
      discountValue: item.discount ?? 0,
      fees: [],
      taxRate: 0,
    });

    const number = await nextDocumentNumber("HF", year);
    const createdAt = new Date(`${arrivalDate}T09:15:00Z`);
    const [stay] = await db
      .insert(stays)
      .values({
        number,
        clientId,
        roomLabel: item.room,
        arrivalDate,
        arrivalTime: "14:00",
        departureDate,
        departureTime: "11:00",
        nights,
        nightlyRate: item.rate,
        roomCount: item.rooms ?? 1,
        guestCount: item.guests ?? 1,
        discountValue: String(item.discount ?? 0),
        notes: item.notes ?? "",
        lifecycle: item.lifecycle,
        preparedAt: item.lifecycle === "prepare" ? createdAt : null,
        cancelledAt: item.lifecycle === "annule" ? createdAt : null,
        cancelReason: item.cancelReason ?? "",
        isDemo: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: stays.id });

    if (services.length) {
      await db.insert(stayServices).values(
        services.map((s, position) => ({ ...s, stayId: stay.id, position })),
      );
    }

    await db.insert(stayEvents).values({
      stayId: stay.id,
      kind: "creation",
      message: `Document interne ${number} créé (données de démonstration).`,
      createdAt,
    });
    if (item.lifecycle === "prepare") {
      await db.insert(stayEvents).values({
        stayId: stay.id,
        kind: "preparation",
        message: "Document marqué comme préparé.",
        createdAt,
      });
    }
    if (item.lifecycle === "annule") {
      await db.insert(stayEvents).values({
        stayId: stay.id,
        kind: "annulation",
        message: `Document annulé : ${item.cancelReason}`,
        createdAt,
      });
    }

    for (const [offset, amount, method, note] of item.pay) {
      const paidOn = addDays(today, offset);
      await db.insert(payments).values({
        stayId: stay.id,
        kind: "paiement",
        paidOn,
        amount,
        method,
        note,
        isDemo: true,
        createdAt: new Date(`${paidOn}T10:30:00Z`),
      });
      await db.insert(stayEvents).values({
        stayId: stay.id,
        kind: "paiement",
        message: `Paiement de ${amount} FCFA enregistré (${method}).`,
        createdAt: new Date(`${paidOn}T10:30:00Z`),
      });
    }

    const balance = computeBalance(
      totals.total,
      item.pay.map(([, amount]) => ({ kind: "paiement", amount })),
    );
    if (balance.tropPercu > 0) {
      await db.insert(stayEvents).values({
        stayId: stay.id,
        kind: "alerte",
        message: `Trop-perçu de ${balance.tropPercu} FCFA à restituer au client.`,
      });
    }
    created += 1;
  }

  return { created };
}

export async function clearDemo(): Promise<void> {
  const demoStays = await db.select({ id: stays.id }).from(stays).where(eq(stays.isDemo, true));
  const ids = demoStays.map((s) => s.id);
  if (ids.length) {
    await db.delete(payments).where(inArray(payments.stayId, ids));
    await db.delete(stays).where(inArray(stays.id, ids));
  }
  await db.delete(clients).where(eq(clients.isDemo, true));
}

export async function resetDemo(): Promise<{ created: number }> {
  await clearDemo();
  return seedDemo();
}
