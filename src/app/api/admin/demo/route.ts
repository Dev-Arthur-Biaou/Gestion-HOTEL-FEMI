import { ApiError, fail, guard, ok, readJson } from "@/lib/api";
import { clearDemo, resetDemo } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await guard();
    const body = await readJson<{ action?: string }>(request);
    if (body.action === "clear") {
      await clearDemo();
      return ok({ ok: true, created: 0 });
    }
    if (body.action === "reset") {
      const result = await resetDemo();
      return ok({ ok: true, ...result });
    }
    throw new ApiError("Action inconnue.");
  } catch (error) {
    return fail(error);
  }
}
