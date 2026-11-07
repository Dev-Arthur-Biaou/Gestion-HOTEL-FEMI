import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

export const DEMO_CREDENTIALS = {
  email: "reception@hotelfemi.bj",
  password: "femi2026",
};

/**
 * Initialisation idempotente : sur un poste neuf, seule la variable DATABASE_URL
 * est nécessaire. Les tables sont créées si absentes, puis le compte réception
 * et un jeu de démonstration (clairement marqué) sont enregistrés.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL CONSTRAINT users_email_unique UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'reception',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  hotel_name text NOT NULL DEFAULT 'Hotel Fêmi',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  logo text NOT NULL DEFAULT '',
  payment_info text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'XOF',
  footer_text text NOT NULL DEFAULT '',
  commercial_notes text NOT NULL DEFAULT '',
  bank_details text NOT NULL DEFAULT '',
  momo_details text NOT NULL DEFAULT '',
  doc_prefix text NOT NULL DEFAULT 'HF',
  tax_label text NOT NULL DEFAULT '',
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  extra_fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_categories jsonb NOT NULL DEFAULT '["Restauration","Boisson","Blanchisserie","Transport","Autre"]'::jsonb,
  payment_methods jsonb NOT NULL DEFAULT '["Espèces","Mobile Money","Carte","Virement","Autre"]'::jsonb,
  default_nightly_rate integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS clients (
  id serial PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  billing_info text NOT NULL DEFAULT '',
  ifu text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (name);
CREATE TABLE IF NOT EXISTS stays (
  id serial PRIMARY KEY,
  number text NOT NULL CONSTRAINT stays_number_unique UNIQUE,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  room_label text NOT NULL DEFAULT '',
  arrival_date date NOT NULL,
  arrival_time text NOT NULL DEFAULT '14:00',
  departure_date date NOT NULL,
  departure_time text NOT NULL DEFAULT '11:00',
  nights integer NOT NULL DEFAULT 1,
  nightly_rate integer NOT NULL DEFAULT 0,
  room_count integer NOT NULL DEFAULT 1,
  guest_count integer NOT NULL DEFAULT 1,
  discount_mode text NOT NULL DEFAULT 'montant',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_label text NOT NULL DEFAULT '',
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  lifecycle text NOT NULL DEFAULT 'brouillon',
  prepared_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stays_arrival_idx ON stays (arrival_date);
CREATE INDEX IF NOT EXISTS stays_client_idx ON stays (client_id);
CREATE TABLE IF NOT EXISTS stay_services (
  id serial PRIMARY KEY,
  stay_id integer NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Autre',
  description text NOT NULL DEFAULT '',
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  stay_id integer NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'paiement',
  paid_on date NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'Espèces',
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_stay_idx ON payments (stay_id);
CREATE TABLE IF NOT EXISTS stay_events (
  id serial PRIMARY KEY,
  stay_id integer NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
`;

let readyPromise: Promise<void> | null = null;

export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = init().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function init(): Promise<void> {
  await db.execute(sql.raw(SCHEMA_SQL));
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      name: "Réception Fêmi",
      email: DEMO_CREDENTIALS.email,
      passwordHash: hashPassword(DEMO_CREDENTIALS.password),
      role: "administrateur",
    });
    await seedDemo();
  }
}
