import { fail, guard, ok, readJson } from "@/lib/api";
import { createStay, listStays } from "@/lib/stays";
import type { StayInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await guard();
    const url = new URL(request.url);
    const stays = await listStays({
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "tous",
      dateField: url.searchParams.get("dateField") ?? "arrivee",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      sort: url.searchParams.get("sort") ?? "recent",
      dir: url.searchParams.get("dir") ?? "desc",
      unpaidOnly: url.searchParams.get("unpaid") === "1",
      clientId: Number(url.searchParams.get("clientId")) || undefined,
    });
    return ok({ stays });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard();
    const body = await readJson<StayInput>(request);
    const stay = await createStay(body);
    return ok({ stay }, 201);
  } catch (error) {
    return fail(error);
  }
}
