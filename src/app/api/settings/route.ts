import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ApiError, fail, guard, ok, optionalString, readJson } from "@/lib/api";
import { getSettings } from "@/lib/stays";
import { num, type Fee } from "@/lib/money";
import type { SettingsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await guard();
    return ok({ settings: await getSettings() });
  } catch (error) {
    return fail(error);
  }
}

function cleanList(value: unknown, label: string): string[] {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list
    .map((v) => String(v ?? "").trim().slice(0, 60))
    .filter((v) => v.length > 0);
  const unique = [...new Set(cleaned)];
  if (unique.length === 0) throw new ApiError(`La liste « ${label} » doit contenir au moins une valeur.`);
  return unique;
}

export async function PUT(request: Request) {
  try {
    await guard();
    const body = await readJson<Partial<SettingsDTO>>(request);
    const prefix = String(body.docPrefix ?? "HF").trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,8}$/.test(prefix)) {
      throw new ApiError("Préfixe de numérotation invalide (lettres, chiffres ou tiret, 8 caractères max).");
    }
    const taxRate = num(body.taxRate);
    if (taxRate < 0 || taxRate > 100) throw new ApiError("Taux de taxe invalide (0 à 100).");
    const logo = String(body.logo ?? "");
    if (logo && !/^data:image\/(png|jpeg|jpg);base64,/.test(logo)) {
      throw new ApiError("Logo invalide : utilisez une image PNG ou JPG.");
    }
    if (logo.length > 900_000) throw new ApiError("Logo trop lourd : 600 Ko maximum.");

    const fees: Fee[] = (Array.isArray(body.extraFees) ? body.extraFees : [])
      .filter((f) => String(f?.label ?? "").trim() !== "")
      .map((f) => ({
        label: String(f.label).trim().slice(0, 80),
        mode: f.mode === "pourcentage" ? "pourcentage" : "fixe",
        value: num(f.value),
      }));

    const nightly = Math.round(num(body.defaultNightlyRate));
    if (nightly < 0) throw new ApiError("Tarif par nuit invalide.");

    await db
      .update(settings)
      .set({
        hotelName: optionalString(body.hotelName, 120) || "Hotel Fêmi",
        address: optionalString(body.address, 300),
        phone: optionalString(body.phone, 80),
        email: optionalString(body.email, 120),
        logo,
        paymentInfo: optionalString(body.paymentInfo, 500),
        currency: "XOF",
        footerText: optionalString(body.footerText, 500),
        commercialNotes: optionalString(body.commercialNotes, 800),
        bankDetails: optionalString(body.bankDetails, 500),
        momoDetails: optionalString(body.momoDetails, 300),
        docPrefix: prefix,
        taxLabel: optionalString(body.taxLabel, 80),
        taxRate: String(taxRate),
        extraFees: fees,
        serviceCategories: cleanList(body.serviceCategories, "catégories de services"),
        paymentMethods: cleanList(body.paymentMethods, "moyens de paiement"),
        defaultNightlyRate: nightly,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));

    return ok({ settings: await getSettings() });
  } catch (error) {
    return fail(error);
  }
}
