import { fail, guard, ok } from "@/lib/api";
import { buildDashboard } from "@/lib/stays";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await guard();
    return ok(await buildDashboard());
  } catch (error) {
    return fail(error);
  }
}
