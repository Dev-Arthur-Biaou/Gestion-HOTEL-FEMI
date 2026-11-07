import { ApiError, fail, guard, ok, optionalString, readJson, requiredString } from "@/lib/api";
import { clientsOverview } from "@/lib/stays";
import { db } from "@/db";
import { clients } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await guard();
    return ok({ clients: await clientsOverview() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard();
    const body = await readJson<Record<string, unknown>>(request);
    const name = requiredString(body.name, "nom du client");
    const phone = optionalString(body.phone, 60);
    const duplicate = (await clientsOverview()).find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && (!phone || c.phone === phone),
    );
    if (duplicate) throw new ApiError("Un client avec ce nom et ce téléphone existe déjà.", 409);
    const [row] = await db
      .insert(clients)
      .values({
        name,
        phone,
        email: optionalString(body.email, 120),
        address: optionalString(body.address, 300),
        billingInfo: optionalString(body.billingInfo, 500),
        ifu: optionalString(body.ifu, 40),
        notes: optionalString(body.notes, 1000),
      })
      .returning();
    return ok({ client: { ...row, createdAt: row.createdAt.toISOString() } }, 201);
  } catch (error) {
    return fail(error);
  }
}
