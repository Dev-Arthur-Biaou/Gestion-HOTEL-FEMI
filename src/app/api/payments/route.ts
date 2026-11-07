import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, stays } from "@/db/schema";
import { ApiError, fail, guard, ok, optionalString, positiveInt, readJson, requiredString } from "@/lib/api";
import { isISODate, todayISO } from "@/lib/dates";
import { addEvent, allPayments, getStay } from "@/lib/stays";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await guard();
    return ok({ payments: await allPayments() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard();
    const body = await readJson<{
      stayId?: number;
      kind?: string;
      paidOn?: string;
      amount?: number;
      method?: string;
      reference?: string;
      note?: string;
      confirmOverpay?: boolean;
    }>(request);

    const stayId = positiveInt(body.stayId, "séjour", { min: 1 });
    const stay = await getStay(stayId);
    if (stay.lifecycle === "annule") {
      throw new ApiError("Ce document est annulé : aucun paiement ne peut y être ajouté.");
    }
    const kind = body.kind === "remboursement" ? "remboursement" : "paiement";
    const amount = positiveInt(body.amount, "montant", { min: 1 });
    const paidOn = String(body.paidOn ?? todayISO());
    if (!isISODate(paidOn)) throw new ApiError("Date de paiement invalide.");
    const method = requiredString(body.method, "moyen de paiement", 60);

    if (kind === "remboursement" && amount > stay.balance.net) {
      throw new ApiError(
        `Remboursement impossible : ${formatMoney(stay.balance.net)} ont été reçus sur ce séjour.`,
      );
    }
    if (kind === "paiement" && amount > stay.balance.solde && !body.confirmOverpay) {
      return ok(
        {
          code: "overpay",
          solde: stay.balance.solde,
          excess: amount - stay.balance.solde,
          error: `Le montant dépasse le solde dû (${formatMoney(stay.balance.solde)}). Confirmez pour enregistrer un trop-perçu de ${formatMoney(amount - stay.balance.solde)}.`,
        },
        409,
      );
    }

    const [row] = await db
      .insert(payments)
      .values({
        stayId,
        kind,
        paidOn,
        amount,
        method,
        reference: optionalString(body.reference, 80),
        note: optionalString(body.note, 300),
      })
      .returning();

    await addEvent(
      stayId,
      kind === "remboursement" ? "remboursement" : "paiement",
      `${kind === "remboursement" ? "Remboursement" : "Paiement"} de ${formatMoney(amount)} — ${method}.`,
    );
    if (stay.lifecycle === "brouillon") {
      await db
        .update(stays)
        .set({ lifecycle: "prepare", preparedAt: new Date(), updatedAt: new Date() })
        .where(eq(stays.id, stayId));
      await addEvent(stayId, "preparation", "Document préparé automatiquement (paiement enregistré).");
    }
    const updated = await getStay(stayId);
    if (updated.balance.tropPercu > 0) {
      await addEvent(
        stayId,
        "alerte",
        `Trop-perçu de ${formatMoney(updated.balance.tropPercu)} à restituer au client.`,
      );
    }
    return ok({ payment: { ...row, createdAt: row.createdAt.toISOString() }, stay: await getStay(stayId) }, 201);
  } catch (error) {
    return fail(error);
  }
}
