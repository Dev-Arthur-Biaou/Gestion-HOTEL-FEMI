import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, stays } from "@/db/schema";
import { ApiError, fail, guard, ok, optionalString, parseId, readJson, requiredString } from "@/lib/api";
import { listStays } from "@/lib/stays";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!rows[0]) throw new ApiError("Client introuvable.", 404);
    const history = await listStays({ clientId: id, sort: "arrivee", dir: "desc" });
    return ok({ client: { ...rows[0], createdAt: rows[0].createdAt.toISOString() }, stays: history });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const body = await readJson<Record<string, unknown>>(request);
    const [row] = await db
      .update(clients)
      .set({
        name: requiredString(body.name, "nom du client"),
        phone: optionalString(body.phone, 60),
        email: optionalString(body.email, 120),
        address: optionalString(body.address, 300),
        billingInfo: optionalString(body.billingInfo, 500),
        ifu: optionalString(body.ifu, 40),
        notes: optionalString(body.notes, 1000),
      })
      .where(eq(clients.id, id))
      .returning();
    if (!row) throw new ApiError("Client introuvable.", 404);
    return ok({ client: { ...row, createdAt: row.createdAt.toISOString() } });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const linked = await db.select({ id: stays.id }).from(stays).where(eq(stays.clientId, id));
    if (linked.length) {
      throw new ApiError(
        `Suppression impossible : ${linked.length} séjour(s) sont rattachés à ce client. Annulez ou conservez les documents liés.`,
        409,
      );
    }
    const [row] = await db.delete(clients).where(eq(clients.id, id)).returning();
    if (!row) throw new ApiError("Client introuvable.", 404);
    return ok({ ok: true, client: row });
  } catch (error) {
    return fail(error);
  }
}
