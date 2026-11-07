import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { ensureReady } from "@/lib/bootstrap";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as unknown as Record<string, unknown>, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  console.error("[api]", error);
  return NextResponse.json(
    { error: `Enregistrement impossible : ${message}` },
    { status: 500 },
  );
}

/** Point d'entrée commun : initialise la base si besoin puis vérifie la session. */
export async function guard(): Promise<SessionUser> {
  await ensureReady();
  const user = await getSessionUser();
  if (!user) throw new ApiError("Session expirée. Merci de vous reconnecter.", 401);
  return user;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Données envoyées illisibles.", 400);
  }
}

export function requiredString(value: unknown, label: string, max = 300): string {
  const s = String(value ?? "").trim();
  if (!s) throw new ApiError(`Le champ « ${label} » est obligatoire.`);
  if (s.length > max) throw new ApiError(`Le champ « ${label} » est trop long.`);
  return s;
}

export function optionalString(value: unknown, max = 2000): string {
  return String(value ?? "").trim().slice(0, max);
}

export function positiveInt(value: unknown, label: string, { min = 0, max = 1_000_000_000 } = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ApiError(`Montant ou quantité invalide pour « ${label} ».`);
  }
  return Math.round(n);
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("Dossier introuvable.", 404);
  return id;
}
