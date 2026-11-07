import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ApiError, fail, guard, ok, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await guard();
    const body = await readJson<{ current?: string; next?: string }>(request);
    const next = String(body.next ?? "");
    if (next.length < 6) throw new ApiError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!rows[0] || !verifyPassword(String(body.current ?? ""), rows[0].passwordHash)) {
      throw new ApiError("Mot de passe actuel incorrect.", 403);
    }
    await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
