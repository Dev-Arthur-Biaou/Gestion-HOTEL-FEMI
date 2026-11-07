import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stays } from "@/db/schema";
import { ApiError, fail, guard, ok, parseId, readJson } from "@/lib/api";
import { addEvent, getStay } from "@/lib/stays";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await guard();
    const id = parseId((await ctx.params).id);
    const body = await readJson<{ action?: string; reason?: string }>(request);
    const stay = await getStay(id);
    const action = body.action ?? "";

    if (action === "preparer") {
      if (stay.lifecycle === "annule") throw new ApiError("Document annulé : réactivez-le d'abord.");
      await db
        .update(stays)
        .set({ lifecycle: "prepare", preparedAt: new Date(), updatedAt: new Date() })
        .where(eq(stays.id, id));
      await addEvent(id, "preparation", "Document marqué comme préparé.");
    } else if (action === "brouillon") {
      if (stay.payments.length > 0) {
        throw new ApiError("Impossible : des paiements sont déjà enregistrés sur ce document.");
      }
      await db
        .update(stays)
        .set({ lifecycle: "brouillon", preparedAt: null, updatedAt: new Date() })
        .where(eq(stays.id, id));
      await addEvent(id, "modification", "Document repassé en brouillon.");
    } else if (action === "annuler") {
      const reason = String(body.reason ?? "").trim();
      if (!reason) throw new ApiError("Merci d'indiquer le motif de l'annulation.");
      if (stay.lifecycle === "annule") throw new ApiError("Ce document est déjà annulé.");
      await db
        .update(stays)
        .set({ lifecycle: "annule", cancelledAt: new Date(), cancelReason: reason, updatedAt: new Date() })
        .where(eq(stays.id, id));
      await addEvent(id, "annulation", `Document annulé : ${reason}`);
    } else if (action === "reactiver") {
      if (stay.lifecycle !== "annule") throw new ApiError("Ce document n'est pas annulé.");
      await db
        .update(stays)
        .set({
          lifecycle: stay.payments.length ? "prepare" : "brouillon",
          cancelledAt: null,
          cancelReason: "",
          updatedAt: new Date(),
        })
        .where(eq(stays.id, id));
      await addEvent(id, "modification", "Document réactivé — le numéro interne est conservé.");
    } else {
      throw new ApiError("Action inconnue.");
    }

    return ok({ stay: await getStay(id) });
  } catch (error) {
    return fail(error);
  }
}
