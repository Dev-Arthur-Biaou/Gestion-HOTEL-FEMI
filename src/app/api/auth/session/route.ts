import { getSessionUser } from "@/lib/auth";
import { ensureReady } from "@/lib/bootstrap";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureReady();
    const user = await getSessionUser();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}
