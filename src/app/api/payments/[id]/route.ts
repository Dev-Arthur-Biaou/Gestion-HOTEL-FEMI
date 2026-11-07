import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { ApiError, fail, guard, ok, parseId, readJson } from "@/lib/api";
import { addEvent, getStay } from "@/lib/stays";
import { formatMoney } from "@/lib/money";
import { isISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const body = await readJson<{ paidOn?: string; method?: string; reference?: string; note?: string; amount?: number }>(request);
    const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!rows[0]) throw new ApiError("Paiement introuvable.", 404);
    const paidOn = String(body.paidOn ?? rows[0].paidOn);
    if (!isISODate(paidOn)) throw new ApiError("Date de paiement invalide.");
    const amount = Math.round(Number(body.amount ?? rows[0].amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError("Montant invalide.");
    await db
      .update(payments)
      .set({
        paidOn,
        amount,
        method: String(body.method ?? rows[0].method).slice(0, 60),
        reference: String(body.reference ?? rows[0].reference).slice(0, 80),
        note: String(body.note ?? rows[0].note).slice(0, 300),
      })
      .where(eq(payments.id, id));
    await addEvent(rows[0].stayId, "modification", `Paiement modifié : ${formatMoney(amount)}.`);
    return ok({ stay: await getStay(rows[0].stayId) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(payments).where(eq(payments.id, id)).returning();
    if (!row) throw new ApiError("Paiement introuvable.", 404);
    await addEvent(
      row.stayId,
      "annulation",
      `Paiement de ${formatMoney(row.amount)} supprimé (${row.method}) — trace conservée dans l'historique.`,
    );
    return ok({ ok: true, payment: { ...row, createdAt: row.createdAt.toISOString() }, stay: await getStay(row.stayId) });
  } catch (error) {
    return fail(error);
  }
}
