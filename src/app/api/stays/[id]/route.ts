import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stays } from "@/db/schema";
import { ApiError, fail, guard, ok, parseId, readJson } from "@/lib/api";
import { addEvent, getStay, updateStay } from "@/lib/stays";
import type { StayInput } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await guard();
    return ok({ stay: await getStay(parseId((await ctx.params).id)) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const body = await readJson<StayInput>(request);
    return ok({ stay: await updateStay(id, body) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const stay = await getStay(id);
    if (stay.lifecycle !== "brouillon" || stay.payments.length > 0) {
      throw new ApiError(
        "Seul un brouillon sans paiement peut être supprimé. Utilisez « Annuler le document » pour conserver l'historique.",
        409,
      );
    }
    await db.delete(stays).where(eq(stays.id, id));
    return ok({ ok: true, stay });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const body = await readJson<{ notes?: string }>(request);
    await db.update(stays).set({ notes: String(body.notes ?? "").slice(0, 1000), updatedAt: new Date() }).where(eq(stays.id, id));
    await addEvent(id, "modification", "Notes internes mises à jour.");
    return ok({ stay: await getStay(id) });
  } catch (error) {
    return fail(error);
  }
}
