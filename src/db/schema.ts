import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  date,
  index,
} from "drizzle-orm/pg-core";

export type ExtraFee = { label: string; mode: "fixe" | "pourcentage"; value: number };

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("reception"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  hotelName: text("hotel_name").notNull().default("Hotel Fêmi"),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  logo: text("logo").notNull().default(""),
  paymentInfo: text("payment_info").notNull().default(""),
  currency: text("currency").notNull().default("XOF"),
  footerText: text("footer_text").notNull().default(""),
  commercialNotes: text("commercial_notes").notNull().default(""),
  bankDetails: text("bank_details").notNull().default(""),
  momoDetails: text("momo_details").notNull().default(""),
  docPrefix: text("doc_prefix").notNull().default("HF"),
  taxLabel: text("tax_label").notNull().default(""),
  taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
  extraFees: jsonb("extra_fees").$type<ExtraFee[]>().notNull().default([]),
  serviceCategories: jsonb("service_categories")
    .$type<string[]>()
    .notNull()
    .default(["Restauration", "Boisson", "Blanchisserie", "Transport", "Autre"]),
  paymentMethods: jsonb("payment_methods")
    .$type<string[]>()
    .notNull()
    .default(["Espèces", "Mobile Money", "Carte", "Virement", "Autre"]),
  defaultNightlyRate: integer("default_nightly_rate").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    billingInfo: text("billing_info").notNull().default(""),
    ifu: text("ifu").notNull().default(""),
    notes: text("notes").notNull().default(""),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const stays = pgTable(
  "stays",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    roomLabel: text("room_label").notNull().default(""),
    arrivalDate: date("arrival_date", { mode: "string" }).notNull(),
    arrivalTime: text("arrival_time").notNull().default("14:00"),
    departureDate: date("departure_date", { mode: "string" }).notNull(),
    departureTime: text("departure_time").notNull().default("11:00"),
    nights: integer("nights").notNull().default(1),
    nightlyRate: integer("nightly_rate").notNull().default(0),
    roomCount: integer("room_count").notNull().default(1),
    guestCount: integer("guest_count").notNull().default(1),
    discountMode: text("discount_mode").notNull().default("montant"),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
    fees: jsonb("fees").$type<ExtraFee[]>().notNull().default([]),
    taxLabel: text("tax_label").notNull().default(""),
    taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    notes: text("notes").notNull().default(""),
    lifecycle: text("lifecycle").notNull().default("brouillon"),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason").notNull().default(""),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stays_arrival_idx").on(t.arrivalDate),
    index("stays_client_idx").on(t.clientId),
  ],
);

export const stayServices = pgTable("stay_services", {
  id: serial("id").primaryKey(),
  stayId: integer("stay_id")
    .notNull()
    .references(() => stays.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("Autre"),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: integer("unit_price").notNull().default(0),
  position: integer("position").notNull().default(0),
});

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    stayId: integer("stay_id")
      .notNull()
      .references(() => stays.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("paiement"),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    amount: integer("amount").notNull().default(0),
    method: text("method").notNull().default("Espèces"),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_stay_idx").on(t.stayId)],
);

export const stayEvents = pgTable("stay_events", {
  id: serial("id").primaryKey(),
  stayId: integer("stay_id")
    .notNull()
    .references(() => stays.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const counters = pgTable("counters", {
  year: integer("year").notNull().primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Stay = typeof stays.$inferSelect;
export type StayService = typeof stayServices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type StayEvent = typeof stayEvents.$inferSelect;
