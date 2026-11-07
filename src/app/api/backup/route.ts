import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, counters, payments, settings, stayEvents, stayServices, stays } from "@/db/schema";
import { fail, guard } from "@/lib/api";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await guard();
    const [configRows, clientRows, stayRows, serviceRows, paymentRows, eventRows, counterRows] =
      await Promise.all([
        db.select().from(settings),
        db.select().from(clients),
        db.select().from(stays),
        db.select().from(stayServices),
        db.select().from(payments),
        db.select().from(stayEvents),
        db.select().from(counters),
      ]);
    const version = await db.execute(sql`select version() as v`);
    const payload = {
      format: "hotel-femi-sauvegarde",
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      engine: (version.rows[0] as { v: string }).v,
      settings: configRows,
      clients: clientRows,
      stays: stayRows,
      stayServices: serviceRows,
      payments: paymentRows,
      stayEvents: eventRows,
      counters: counterRows,
    };
    const filename = `Hotel-Femi-Sauvegarde-${todayISO()}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
