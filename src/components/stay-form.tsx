"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  IconAlert,
  IconBed,
  IconCheck,
  IconFile,
  IconMoon,
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/icons";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import { Button, Field, Money, Notice, Segmented, Tag, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { addDays, isISODate, nightsBetween, todayISO } from "@/lib/dates";
import { computeTotals, formatMoney, lineAmount, num, type Fee } from "@/lib/money";
import { useResource } from "@/lib/hooks";
import type { ClientDTO, StayDTO, StayInput } from "@/lib/types";

type ServiceRow = {
  key: string;
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const emptyRow = (key: string, category: string): ServiceRow => ({
  key,
  category,
  description: "",
  quantity: "1",
  unitPrice: "",
});

export function StayForm({ initial }: { initial?: StayDTO }) {
  const router = useRouter();
  const { settings } = useSettings();
  const { push } = useToast();
  const editing = Boolean(initial);
  const { data: clientData } = useResource<{ clients: ClientDTO[] }>("/api/clients");
  const clients = useMemo(() => clientData?.clients ?? [], [clientData]);

  const [clientId, setClientId] = useState<number | null>(initial?.client.id ?? null);
  const [clientSearch, setClientSearch] = useState("");
  const [newClient, setNewClient] = useState(!initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [billingInfo, setBillingInfo] = useState("");
  const [ifu, setIfu] = useState("");

  const [roomLabel, setRoomLabel] = useState(initial?.roomLabel ?? "");
  const [arrivalDate, setArrivalDate] = useState(initial?.arrivalDate ?? todayISO());
  const [arrivalTime, setArrivalTime] = useState(initial?.arrivalTime ?? "14:00");
  const [departureDate, setDepartureDate] = useState(
    initial?.departureDate ?? addDays(todayISO(), 1),
  );
  const [departureTime, setDepartureTime] = useState(initial?.departureTime ?? "11:00");
  const [nightlyRate, setNightlyRate] = useState(
    String(initial?.nightlyRate ?? (settings.defaultNightlyRate || "")),
  );
  const [roomCount, setRoomCount] = useState(String(initial?.roomCount ?? 1));
  const [guestCount, setGuestCount] = useState(String(initial?.guestCount ?? 1));
  const [discountMode, setDiscountMode] = useState(initial?.discountMode ?? "montant");
  const [discountValue, setDiscountValue] = useState(String(initial?.discountValue ?? 0));
  const [fees, setFees] = useState<Fee[]>(initial?.fees ?? settings.extraFees ?? []);
  const [taxLabel, setTaxLabel] = useState(initial?.taxLabel ?? settings.taxLabel ?? "");
  const [taxRate, setTaxRate] = useState(String(initial?.taxRate ?? settings.taxRate ?? 0));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<ServiceRow[]>(() =>
    (initial?.services ?? []).map((s, index) => ({
      key: `init-${index}`,
      category: s.category,
      description: s.description,
      quantity: String(s.quantity),
      unitPrice: String(s.unitPrice),
    })),
  );
  const rowSeq = useRef(0);
  const addRow = useCallback((category: string) => {
    rowSeq.current += 1;
    const row = emptyRow(`n${rowSeq.current}`, category);
    setRows((list) => [...list, row]);
  }, []);

  const [saving, setSaving] = useState<"brouillon" | "prepare" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const selectedClient = clients.find((c) => c.id === clientId) ?? initial?.client ?? null;
  const nights = nightsBetween(arrivalDate, departureDate);

  // Quand l'arrivée change, on garantit au moins une nuit sans écraser une
  // saisie de départ en cours : le départ n'est recalé que s'il devient invalide.
  function changeArrival(value: string) {
    setArrivalDate(value);
    if (!editing && isISODate(value) && nightsBetween(value, departureDate) < 1) {
      setDepartureDate(addDays(value, 1));
    }
  }

  const services = rows.map((r) => ({
    category: r.category,
    description: r.description,
    quantity: num(r.quantity),
    unitPrice: num(r.unitPrice),
  }));

  const totals = computeTotals({
    nights,
    nightlyRate: num(nightlyRate),
    roomCount: num(roomCount, 1),
    services,
    discountMode,
    discountValue: num(discountValue),
    fees,
    taxRate: num(taxRate),
  });

  const dejaRegle = initial?.balance.net ?? 0;
  const soldePrevisionnel = totals.total - dejaRegle;

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    const digits = q.replace(/\D/g, "");
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 6);
  }, [clientSearch, clients]);

  const errors: Record<string, string> = {};
  if (!clientId && !name.trim()) errors.name = "Indiquez le nom du client (ou choisissez une fiche).";
  if (nights < 1) errors.dates = "Le départ doit être postérieur à l'arrivée (au moins 1 nuit).";
  if (num(nightlyRate) <= 0) errors.rate = "Indiquez le prix par nuit.";
  if (num(roomCount, 1) < 1) errors.rooms = "Au moins une chambre.";
  rows.forEach((r, i) => {
    if (r.description.trim() && num(r.quantity) <= 0) errors[`row${i}`] = "Quantité invalide";
    if (r.description.trim() && num(r.unitPrice) < 0) errors[`row${i}`] = "Prix invalide";
    if (!r.description.trim() && num(r.unitPrice) > 0) errors[`row${i}`] = "Description manquante";
  });
  const hasErrors = Object.keys(errors).length > 0;

  function buildPayload(lifecycle: "brouillon" | "prepare"): StayInput {
    return {
      clientId,
      client: clientId
        ? undefined
        : { name, phone, email, address, billingInfo, ifu },
      roomLabel,
      arrivalDate,
      arrivalTime,
      departureDate,
      departureTime,
      nightlyRate: num(nightlyRate),
      roomCount: num(roomCount, 1),
      guestCount: num(guestCount, 1),
      discountMode,
      discountValue: num(discountValue),
      fees: fees.filter((f) => f.label.trim() !== ""),
      taxLabel,
      taxRate: num(taxRate),
      notes,
      services: services.filter((s) => s.description.trim() !== ""),
      lifecycle,
    } as StayInput;
  }

  async function save(lifecycle: "brouillon" | "prepare") {
    setTouched(true);
    setServerError(null);
    if (hasErrors) {
      setServerError("Certains champs demandent une correction. Vos saisies sont conservées.");
      return;
    }
    setSaving(lifecycle);
    try {
      const result = await api<{ stay: StayDTO }>(
        editing ? `/api/stays/${initial!.id}` : "/api/stays",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(buildPayload(lifecycle)) },
      );
      if (!editing && lifecycle === "prepare") {
        await api(`/api/stays/${result.stay.id}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "preparer" }),
        }).catch(() => null);
      }
      push({
        tone: "success",
        title: editing ? "Séjour mis à jour" : `Séjour ${result.stay.number} enregistré`,
        message: `${nights} nuit(s) · total ${formatMoney(totals.total)}.`,
      });
      router.push(`/sejours/${result.stay.id}`);
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error));
      setSaving(null);
    }
  }

  const showError = (key: string) => (touched ? errors[key] : undefined);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <div className="space-y-5">
        <section className="panel anim-rise overflow-hidden">
          <header className="flex items-center gap-3 border-b border-line bg-overlay px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(18,101,82,0.12)] text-palm">
              <IconUsers width={17} height={17} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-[1.05rem] font-semibold">1. Client</h2>
              <p className="text-[0.78rem] text-muted">
                Réutilisez une fiche existante ou créez-en une nouvelle. Seul le nom est obligatoire.
              </p>
            </div>
            {!editing && (
              <Segmented
                size="sm"
                value={newClient ? "nouveau" : "existant"}
                onChange={(v) => {
                  setNewClient(v === "nouveau");
                  if (v === "nouveau") setClientId(null);
                }}
                options={[
                  { value: "existant", label: "Fiche existante" },
                  { value: "nouveau", label: "Nouveau client" },
                ]}
              />
            )}
          </header>

          <div className="space-y-4 p-5">
            {selectedClient && !newClient ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(18,101,82,0.3)] bg-[rgba(18,101,82,0.06)] p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-palm text-[0.9rem] font-bold text-white">
                  {selectedClient.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{selectedClient.name}</p>
                  <p className="text-[0.78rem] text-muted">
                    {selectedClient.phone || "Téléphone non renseigné"}
                    {selectedClient.email ? ` · ${selectedClient.email}` : ""}
                  </p>
                </div>
                {!editing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<IconX width={14} height={14} />}
                    onClick={() => setClientId(null)}
                  >
                    Changer
                  </Button>
                )}
              </div>
            ) : newClient ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom et prénom / raison sociale" required error={showError("name")} className="sm:col-span-2">
                  <input
                    className={cn("field", showError("name") && "field-invalid")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex. Awa Diallo ou Société Kpanla SARL"
                  />
                </Field>
                <Field label="Téléphone" hint="Utile pour retrouver le dossier rapidement.">
                  <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+229 …" />
                </Field>
                <Field label="E-mail (facultatif)">
                  <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.bj" />
                </Field>
                <Field label="Adresse (facultatif)" className="sm:col-span-2">
                  <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ville, quartier…" />
                </Field>
                <Field label="Informations de facturation (facultatif)" className="sm:col-span-2">
                  <input className="field" value={billingInfo} onChange={(e) => setBillingInfo(e.target.value)} placeholder="Service à facturer, référence interne du client…" />
                </Field>
                <Field label="IFU du client (uniquement s'il est fourni)" hint="Aucun identifiant fiscal n'est inventé par le logiciel.">
                  <input className="field" value={ifu} onChange={(e) => setIfu(e.target.value)} placeholder="Laisser vide si non communiqué" />
                </Field>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <IconSearch width={15} height={15} />
                  </span>
                  <input
                    className={cn("field pl-9", showError("name") && "field-invalid")}
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Rechercher par nom ou téléphone…"
                  />
                </div>
                {showError("name") && (
                  <p className="mt-1 flex items-center gap-1 text-[0.74rem] font-semibold text-danger">
                    <IconAlert width={12} height={12} />
                    {errors.name}
                  </p>
                )}
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                  {filteredClients.length === 0 && (
                    <li className="px-4 py-6 text-center text-[0.82rem] text-muted">
                      Aucune fiche trouvée. Basculez sur « Nouveau client » pour la créer.
                    </li>
                  )}
                  {filteredClients.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => setClientId(client.id)}
                        className="row-hover flex w-full items-center gap-3 px-4 py-2.5 text-left"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sand text-[0.78rem] font-bold text-palm">
                          {client.name.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.86rem] font-semibold text-ink">{client.name}</span>
                          <span className="block truncate text-[0.73rem] text-muted">
                            {client.phone || "Téléphone non renseigné"}
                          </span>
                        </span>
                        {typeof client.stayCount === "number" && (
                          <Tag>{client.stayCount} séjour(s)</Tag>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "80ms" }}>
          <header className="flex items-center gap-3 border-b border-line bg-overlay px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(191,81,39,0.12)] text-terre">
              <IconBed width={17} height={17} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-[1.05rem] font-semibold">2. Séjour</h2>
              <p className="text-[0.78rem] text-muted">
                Les nuits sont calculées automatiquement à partir des dates.
              </p>
            </div>
            <Tag tone={nights >= 1 ? "palm" : "terre"}>
              <IconMoon width={12} height={12} />
              {nights} nuit{nights > 1 ? "s" : ""}
            </Tag>
          </header>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Chambre ou type de chambre" className="sm:col-span-2" hint="Ex. Chambre 204 — Deluxe, Suite, Chambre double…">
              <input className="field" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} placeholder="Chambre 101 — Standard" />
            </Field>
            <Field label="Date d'arrivée" required error={showError("dates")}>
              <input type="date" className={cn("field", showError("dates") && "field-invalid")} value={arrivalDate} onChange={(e) => changeArrival(e.target.value)} />
            </Field>
            <Field label="Heure d'arrivée">
              <input type="time" className="field" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
            </Field>
            <Field label="Date de départ" required error={showError("dates")}>
              <input type="date" className={cn("field", showError("dates") && "field-invalid")} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </Field>
            <Field label="Heure de départ">
              <input type="time" className="field" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
            </Field>
            <Field label="Prix par nuit (FCFA)" required error={showError("rate")}>
              <input type="number" min={0} step={500} className={cn("field tabular", showError("rate") && "field-invalid")} value={nightlyRate} onChange={(e) => setNightlyRate(e.target.value)} placeholder="0" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Chambres" error={showError("rooms")}>
                <input type="number" min={1} className="field tabular" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} />
              </Field>
              <Field label="Clients">
                <input type="number" min={1} className="field tabular" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes internes (facultatif)" className="sm:col-span-2" hint="Ces notes restent internes : elles ne figurent pas sur le document remis au client.">
              <textarea className="field min-h-[76px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Préférences, consignes de la réception…" />
            </Field>
          </div>
        </section>

        <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "140ms" }}>
          <header className="flex flex-wrap items-center gap-3 border-b border-line bg-overlay px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(221,161,24,0.18)] text-[#8a6206]">
              <IconPlus width={17} height={17} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-[1.05rem] font-semibold">3. Services supplémentaires</h2>
              <p className="text-[0.78rem] text-muted">
                Catégories modifiables dans les paramètres — n'ajoutez que ce qui a été consommé.
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={<IconPlus width={14} height={14} />} onClick={() => addRow(settings.serviceCategories[0] ?? "Autre")}>
              Ajouter une ligne
            </Button>
          </header>

          <div className="p-5">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong bg-overlay px-5 py-8 text-center">
                <p className="text-[0.86rem] font-semibold text-ink">Aucun service supplémentaire</p>
                <p className="mx-auto mt-1 max-w-md text-[0.78rem] text-muted">
                  Restauration, boisson, blanchisserie, transport… ajoutez uniquement les prestations
                  réellement fournies au client.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {settings.serviceCategories.map((category) => (
                    <button key={category} type="button" className="btn btn-ghost btn-sm" onClick={() => addRow(category)}>
                      <IconPlus width={12} height={12} />
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="hidden gap-2 px-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted lg:grid lg:grid-cols-[9rem_1fr_5rem_7rem_7rem_2rem]">
                  <span>Catégorie</span>
                  <span>Description</span>
                  <span>Qté</span>
                  <span>Prix unit.</span>
                  <span className="text-right">Montant</span>
                  <span />
                </div>
                {rows.map((row, index) => {
                  const amount = lineAmount({
                    category: row.category,
                    description: row.description,
                    quantity: num(row.quantity),
                    unitPrice: num(row.unitPrice),
                  });
                  return (
                    <div key={row.key} className="grid gap-2 rounded-2xl border border-line bg-overlay p-2.5 lg:grid-cols-[9rem_1fr_5rem_7rem_7rem_2rem] lg:items-center lg:border-transparent lg:bg-transparent lg:p-0">
                      <select
                        className="field"
                        value={row.category}
                        onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, category: e.target.value } : r)))}
                      >
                        {[...new Set([...settings.serviceCategories, row.category])].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        className={cn("field", showError(`row${index}`) && "field-invalid")}
                        value={row.description}
                        placeholder="Ex. Petit-déjeuner, navette aéroport…"
                        onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, description: e.target.value } : r)))}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        className="field tabular"
                        value={row.quantity}
                        onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value } : r)))}
                      />
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="field tabular"
                        value={row.unitPrice}
                        placeholder="0"
                        onChange={(e) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, unitPrice: e.target.value } : r)))}
                      />
                      <span className="tabular rounded-xl bg-sand px-2 py-2 text-right text-[0.82rem] font-bold text-ink">
                        {formatMoney(amount)}
                      </span>
                      <button
                        type="button"
                        className="justify-self-end rounded-lg p-2 text-muted transition hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                        onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                        aria-label="Supprimer la ligne"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                      {showError(`row${index}`) && (
                        <p className="col-span-full text-[0.74rem] font-semibold text-danger">
                          {errors[`row${index}`]}
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button size="sm" variant="ghost" icon={<IconPlus width={14} height={14} />} onClick={() => addRow(settings.serviceCategories[0] ?? "Autre")}>
                  Ajouter une ligne
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "200ms" }}>
          <header className="flex items-center gap-3 border-b border-line bg-overlay px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(47,111,237,0.12)] text-info">
              <IconWallet width={17} height={17} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-[1.05rem] font-semibold">4. Remise, frais et taxe</h2>
              <p className="text-[0.78rem] text-muted">
                Aucune taxe n'est appliquée par défaut. Toute taxe doit être vérifiée auprès de votre
                comptable.
              </p>
            </div>
          </header>

          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <Field label="Type de remise">
                <Segmented
                  value={discountMode}
                  onChange={setDiscountMode}
                  options={[
                    { value: "montant", label: "Montant FCFA" },
                    { value: "pourcentage", label: "Pourcentage" },
                  ]}
                />
              </Field>
              <Field label={discountMode === "pourcentage" ? "Remise (%)" : "Remise (FCFA)"}>
                <input type="number" min={0} className="field tabular" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">Autres frais configurés</span>
                <Button size="sm" variant="ghost" icon={<IconPlus width={13} height={13} />} onClick={() => setFees((f) => [...f, { label: "", mode: "fixe", value: 0 }])}>
                  Ajouter un frais
                </Button>
              </div>
              {fees.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong bg-overlay px-4 py-3 text-[0.8rem] text-muted">
                  Aucun frais supplémentaire. Vous pouvez en configurer par défaut dans les paramètres.
                </p>
              ) : (
                <div className="space-y-2">
                  {fees.map((fee, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem_2rem] sm:items-center">
                      <input
                        className="field"
                        value={fee.label}
                        placeholder="Libellé du frais"
                        onChange={(e) => setFees((list) => list.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))}
                      />
                      <select
                        className="field"
                        value={fee.mode}
                        onChange={(e) => setFees((list) => list.map((f, i) => (i === index ? { ...f, mode: e.target.value as Fee["mode"] } : f)))}
                      >
                        <option value="fixe">Montant fixe</option>
                        <option value="pourcentage">Pourcentage</option>
                      </select>
                      <input
                        type="number"
                        className="field tabular"
                        value={fee.value}
                        onChange={(e) => setFees((list) => list.map((f, i) => (i === index ? { ...f, value: num(e.target.value) } : f)))}
                      />
                      <button
                        type="button"
                        className="justify-self-end rounded-lg p-2 text-muted transition hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                        onClick={() => setFees((list) => list.filter((_, i) => i !== index))}
                        aria-label="Supprimer le frais"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field label="Libellé de la taxe (facultatif)" hint="Laisser vide si aucune taxe ne doit apparaître.">
                <input className="field" value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder="Ex. Taxe vérifiée avec le comptable" />
              </Field>
              <Field label="Taux (%)">
                <input type="number" min={0} max={100} step="0.1" className="field tabular" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </Field>
            </div>
            {num(taxRate) > 0 && (
              <Notice tone="warning" title="Taxe à confirmer">
                Le taux saisi s'applique au sous-total du document. Le logiciel ne connaît aucune
                règle fiscale : faites valider ce taux avant de remettre le document.
              </Notice>
            )}
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-32 xl:h-fit">
        <div className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "100ms" }}>
          <div className="border-b border-line bg-nuit px-5 py-4 text-[#e9f3ed]">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-or-soft">
              Récapitulatif en direct
            </p>
            <p className="mt-1 font-display text-[1.6rem] font-semibold text-[#fdf6e8]">
              {formatMoney(totals.total)}
            </p>
            <p className="text-[0.76rem] text-[#9dbcae]">
              {nights} nuit{nights > 1 ? "s" : ""} × {formatMoney(num(nightlyRate))} ×{" "}
              {num(roomCount, 1)} chambre{num(roomCount, 1) > 1 ? "s" : ""}
            </p>
          </div>

          <dl className="space-y-2 px-5 py-4 text-[0.84rem]">
            <div className="flex justify-between">
              <dt className="text-muted">Hébergement</dt>
              <dd className="tabular font-semibold">{formatMoney(totals.hebergement)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Services ({services.filter((s) => s.description.trim()).length})</dt>
              <dd className="tabular font-semibold">{formatMoney(totals.servicesTotal)}</dd>
            </div>
            {totals.remise > 0 && (
              <div className="flex justify-between text-success">
                <dt>Remise</dt>
                <dd className="tabular font-semibold">−{formatMoney(totals.remise)}</dd>
              </div>
            )}
            {totals.fraisTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Autres frais</dt>
                <dd className="tabular font-semibold">{formatMoney(totals.fraisTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-muted">Sous-total</dt>
              <dd className="tabular font-semibold">{formatMoney(totals.sousTotal)}</dd>
            </div>
            {totals.taxe > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">
                  {taxLabel || "Taxe"} ({num(taxRate)} %)
                </dt>
                <dd className="tabular font-semibold">{formatMoney(totals.taxe)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-overlay px-3 py-2.5">
              <dt className="font-bold text-ink">Total à payer</dt>
              <dd className="tabular font-display text-lg font-bold text-palm">
                {formatMoney(totals.total)}
              </dd>
            </div>
            {editing && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">Déjà réglé</dt>
                  <dd className="tabular font-semibold text-success">{formatMoney(dejaRegle)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Solde prévisionnel</dt>
                  <dd className={cn("tabular font-bold", soldePrevisionnel > 0 ? "text-terre" : "text-success")}>
                    <Money value={soldePrevisionnel} />
                  </dd>
                </div>
              </>
            )}
          </dl>

          <div className="space-y-2.5 border-t border-line bg-overlay px-5 py-4">
            {serverError && <Notice tone="danger">{serverError}</Notice>}
            {touched && hasErrors && !serverError && (
              <Notice tone="warning">Corrigez les champs signalés avant d'enregistrer.</Notice>
            )}
            <Button
              variant="primary"
              className="w-full"
              loading={saving === "prepare"}
              disabled={saving !== null}
              icon={<IconCheck width={15} height={15} />}
              onClick={() => save("prepare")}
            >
              {editing ? "Enregistrer les modifications" : "Enregistrer et préparer"}
            </Button>
            {!editing && (
              <Button
                variant="ghost"
                className="w-full"
                loading={saving === "brouillon"}
                disabled={saving !== null}
                icon={<IconSave width={15} height={15} />}
                onClick={() => save("brouillon")}
              >
                Garder en brouillon
              </Button>
            )}
            <Link href={editing ? `/sejours/${initial!.id}` : "/sejours"} className="btn btn-ghost w-full">
              Annuler et revenir
            </Link>
            <p className="flex items-start gap-1.5 pt-1 text-[0.72rem] leading-snug text-muted">
              <IconFile width={13} height={13} className="mt-0.5 shrink-0" />
              {editing
                ? `Le numéro interne ${initial!.number} est conservé.`
                : `Un identifiant interne ${settings.docPrefix}-${new Date().getFullYear()}-XXXX sera attribué automatiquement.`}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
