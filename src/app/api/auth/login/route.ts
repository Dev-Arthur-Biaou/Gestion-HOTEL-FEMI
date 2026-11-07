import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { ensureReady } from "@/lib/bootstrap";
import { fail, ok, readJson, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureReady();
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) throw new ApiError("Identifiant et mot de passe obligatoires.");
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError("Identifiant ou mot de passe incorrect.", 401);
    }
    const { token, expires } = await createSession(user.id);
    await setSessionCookie(token, expires);
    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return fail(error);
  }
}
