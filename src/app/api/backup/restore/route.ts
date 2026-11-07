import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, counters, payments, settings, stayEvents, stayServices, stays } from "@/db/schema";
import { ApiError, fail, guard, ok, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type Backup = {
  format?: string;
  version?: number;
  clients?: Record<string, unknown>[];
  stays?: Record<string, unknown>[];
  stayServices?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  stayEvents?: Record<string, unknown>[];
  settings?: Record<string, unknown>[];
  counters?: Record<string, unknown>[];
  confirm?: boolean;
};

const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "preparedAt",
  "cancelledAt",
  "expiresAt",
]);

function revive(rows: Record<string, unknown>[] | undefined) {
  return (rows ?? []).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = DATE_KEYS.has(key) && typeof value === "string" ? new Date(value) : value;
    }
    return out;
  });
}

export async function POST(request: Request) {
  try {
    await guard();
    const body = await readJson<Backup>(request);
    if (body.format !== "hotel-femi-sauvegarde") {
      throw new ApiError("Fichier de sauvegarde non reconnu : restauration annulée, vos données sont intactes.");
    }
    if (!body.confirm) throw new ApiError("Restauration non confirmée.");
    if (!Array.isArray(body.clients) || !Array.isArray(body.stays)) {
      throw new ApiError("Fichier de sauvegarde incomplet (clients ou séjours manquants).");
    }

    const clientRows = revive(body.clients);
    const stayRows = revive(body.stays);
    const serviceRows = revive(body.stayServices);
    const paymentRows = revive(body.payments);
    const eventRows = revive(body.stayEvents);
    const settingsRows = revive(body.settings);
    const counterRows = revive(body.counters);

    await db.transaction(async (tx) => {
      await tx.delete(payments);
      await tx.delete(stayServices);
      await tx.delete(stayEvents);
      await tx.delete(stays);
      await tx.delete(clients);
      if (clientRows.length) await tx.insert(clients).values(clientRows as never);
      if (stayRows.length) await tx.insert(stays).values(stayRows as never);
      if (serviceRows.length) await tx.insert(stayServices).values(serviceRows as never);
      if (paymentRows.length) await tx.insert(payments).values(paymentRows as never);
      if (eventRows.length) await tx.insert(stayEvents).values(eventRows as never);
      if (settingsRows.length) {
        await tx.delete(settings);
        await tx.insert(settings).values(settingsRows as never);
      }
      for (const row of counterRows) {
        const year = Number(row.year);
        const lastValue = Number(row.lastValue);
        if (!Number.isFinite(year) || !Number.isFinite(lastValue)) continue;
        await tx
          .insert(counters)
          .values({ year, lastValue })
          .onConflictDoUpdate({
            target: counters.year,
            set: { lastValue: sql`greatest(counters.last_value, ${lastValue})` } as never,
          });
      }
      for (const table of ["clients", "stays", "stay_services", "payments", "stay_events"]) {
        await tx.execute(
          sql.raw(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
          ),
        );
      }
    });

    return ok({
      ok: true,
      restored: {
        clients: clientRows.length,
        stays: stayRows.length,
        payments: paymentRows.length,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return fail(error);
    return fail(
      new ApiError(
        `Restauration impossible (${error instanceof Error ? error.message : "erreur inconnue"}). Vos données actuelles n'ont pas été modifiées.`,
        500,
      ),
    );
  }
}
