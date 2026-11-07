import { clearSessionCookie } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
