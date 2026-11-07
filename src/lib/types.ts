import type { Fee, ServiceLine, StayStatus, Totals, Balance } from "@/lib/money";

export type SettingsDTO = {
  hotelName: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  paymentInfo: string;
  currency: string;
  footerText: string;
  commercialNotes: string;
  bankDetails: string;
  momoDetails: string;
  docPrefix: string;
  taxLabel: string;
  taxRate: number;
  extraFees: Fee[];
  serviceCategories: string[];
  paymentMethods: string[];
  defaultNightlyRate: number;
};

export type ClientDTO = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  billingInfo: string;
  ifu: string;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  stayCount?: number;
  totalBalance?: number;
};

export type PaymentDTO = {
  id: number;
  stayId: number;
  kind: "paiement" | "remboursement";
  paidOn: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  createdAt: string;
  stayNumber?: string;
  clientName?: string;
  isDemo?: boolean;
};

export type StayEventDTO = {
  id: number;
  kind: string;
  message: string;
  createdAt: string;
};

export type StayDTO = {
  id: number;
  number: string;
  client: ClientDTO;
  roomLabel: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  nights: number;
  nightlyRate: number;
  roomCount: number;
  guestCount: number;
  discountMode: string;
  discountValue: number;
  fees: Fee[];
  taxLabel: string;
  taxRate: number;
  notes: string;
  lifecycle: string;
  status: StayStatus;
  services: (ServiceLine & { id: number })[];
  payments: PaymentDTO[];
  events?: StayEventDTO[];
  totals: Totals;
  balance: Balance;
  preparedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StayInput = {
  clientId?: number | null;
  client?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    billingInfo?: string;
    ifu?: string;
  };
  roomLabel: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  nightlyRate: number;
  roomCount: number;
  guestCount: number;
  discountMode: string;
  discountValue: number;
  fees: Fee[];
  taxLabel: string;
  taxRate: number;
  notes: string;
  services: ServiceLine[];
  lifecycle: "brouillon" | "prepare";
};

export type DashboardDTO = {
  today: string;
  arrivals: StayDTO[];
  departures: StayDTO[];
  inHouse: StayDTO[];
  recent: StayDTO[];
  unpaid: StayDTO[];
  totals: {
    encaisseJour: number;
    encaisseMois: number;
    soldeTotal: number;
    documentsOuverts: number;
    brouillons: number;
    tropPercu: number;
    nuitsMois: number;
  };
  cashflow: { date: string; amount: number }[];
  methods: { method: string; amount: number }[];
  missingSettings: string[];
};
