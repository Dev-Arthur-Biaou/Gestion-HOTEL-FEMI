"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconDownload,
  IconEye,
  IconFile,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
  IconTrash,
  IconWallet,
  IconX,
} from "@/components/icons";
import { PaymentDialog } from "@/components/payment-dialog";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import {
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Notice,
  Segmented,
  StatusBadge,
  TableSkeleton,
  Tag,
  Toggle,
  cn,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { frDate, relativeDay } from "@/lib/dates";
import { useLocalState, useResource } from "@/lib/hooks";
import { STATUS_LABEL, formatMoney, lineAmount, type StayStatus } from "@/lib/money";
import type { StayDTO } from "@/lib/types";

type Filters = {
  q: string;
  status: string;
  dateField: string;
  from: string;
  to: string;
  sort: string;
  dir: string;
  unpaid: boolean;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  status: "tous",
  dateField: "arrivee",
  from: "",
  to: "",
  sort: "recent",
  dir: "desc",
  unpaid: false,
};

type SavedView = { name: string; filters: Filters };

export default function StaysPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { settings } = useSettings();
  const { push } = useToast();

  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, q: search.get("q") ?? "" });
  const [debounced, setDebounced] = useState(filters.q);
  const [selection, setSelection] = useState<number[]>([]);
  const [drawerStay, setDrawerStay] = useState<StayDTO | null>(null);
  const [cashStay, setCashStay] = useState<StayDTO | null>(null);
  const [bulkCancel, setBulkCancel] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useLocalState<SavedView[]>("femi-vues-sejours", []);
  const [viewName, setViewName] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters.q), 260);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const urlQuery = search.get("q") ?? "";
  useEffect(() => {
    if (!urlQuery) return;
    setFilters((f) => (f.q === urlQuery ? f : { ...f, q: urlQuery }));
    setDebounced(urlQuery);
  }, [urlQuery]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced.trim()) params.set("q", debounced.trim());
    params.set("status", filters.status);
    params.set("dateField", filters.dateField);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("sort", filters.sort);
    params.set("dir", filters.dir);
    if (filters.unpaid) params.set("unpaid", "1");
    return `/api/stays?${params.toString()}`;
  }, [debounced, filters]);

  const { data, setData, loading, error, reload } = useResource<{ stays: StayDTO[] }>(path);
  const stays = useMemo(() => data?.stays ?? [], [data]);

  const totals = useMemo(
    () => ({
      montant: stays.reduce((sum, s) => sum + s.totals.total, 0),
      solde: stays.filter((s) => s.status !== "annule").reduce((sum, s) => sum + s.balance.solde, 0),
      nuits: stays.filter((s) => s.status !== "annule").reduce((sum, s) => sum + s.nights * s.roomCount, 0),
    }),
    [stays],
  );

  const allSelected = stays.length > 0 && selection.length === stays.length;
  const activeFilters =
    filters.status !== "tous" || filters.from || filters.to || filters.unpaid || debounced.trim();

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setSelection([]);
  }

  function toggleSort(column: string) {
    setFilters((f) => ({
      ...f,
      sort: column,
      dir: f.sort === column && f.dir === "desc" ? "asc" : "desc",
    }));
  }

  async function bulkPrepare() {
    setBusy(true);
    const targets = stays.filter((s) => selection.includes(s.id) && s.lifecycle === "brouillon");
    if (targets.length === 0) {
      push({ tone: "info", title: "Aucun brouillon dans la sélection" });
      setBusy(false);
      return;
    }
    setData((current) =>
      current
        ? {
            stays: current.stays.map((s) =>
              targets.some((t) => t.id === s.id)
                ? { ...s, lifecycle: "prepare", status: (s.balance.net > 0 ? "partiel" : "prepare") as StayStatus }
                : s,
            ),
          }
        : current,
    );
    try {
      for (const target of targets) {
        await api(`/api/stays/${target.id}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "preparer" }),
        });
      }
      push({ tone: "success", title: `${targets.length} document(s) préparé(s)` });
      setSelection([]);
      void reload(true);
    } catch (err) {
      push({ tone: "error", title: "Action incomplète", message: errorMessage(err) });
      void reload(true);
    } finally {
      setBusy(false);
    }
  }

  async function bulkCancelDocuments() {
    if (!bulkReason.trim()) return;
    setBusy(true);
    const ids = [...selection];
    try {
      for (const id of ids) {
        await api(`/api/stays/${id}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "annuler", reason: bulkReason.trim() }),
        });
      }
      push({
        tone: "warning",
        title: `${ids.length} document(s) annulé(s)`,
        message: "Les documents restent consultables avec leur historique.",
        action: {
          label: "Rétablir la sélection",
          onClick: async () => {
            for (const id of ids) {
              await api(`/api/stays/${id}/action`, {
                method: "POST",
                body: JSON.stringify({ action: "reactiver" }),
              }).catch(() => null);
            }
            void reload(true);
          },
        },
      });
      setSelection([]);
      setBulkCancel(false);
      setBulkReason("");
      void reload(true);
    } catch (err) {
      push({ tone: "error", title: "Annulation impossible", message: errorMessage(err) });
      void reload(true);
    } finally {
      setBusy(false);
    }
  }

  function exportSelection() {
    const rows = stays.filter((s) => selection.includes(s.id));
    const headers = ["Identifiant", "Client", "Arrivée", "Départ", "Nuits", "Statut", "Total", "Solde"];
    const csv = [headers, ...rows.map((s) => [s.number, s.client.name, s.arrivalDate, s.departureDate, s.nights, STATUS_LABEL[s.status], s.totals.total, s.balance.solde])]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hotel-Femi-selection-${rows.length}-sejours.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push({ tone: "success", title: `${rows.length} ligne(s) exportée(s)` });
  }

  const sortArrow = (column: string) =>
    filters.sort === column ? (filters.dir === "desc" ? " ↓" : " ↑") : "";

  return (
    <div className="space-y-4">
      <section className="panel anim-rise overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <div className="relative min-w-[15rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch width={15} height={15} />
            </span>
            <input
              className="field pl-9"
              placeholder="Nom du client, téléphone, identifiant, chambre…"
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
            />
            {filters.q && (
              <button
                type="button"
                onClick={() => update("q", "")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-terre"
                aria-label="Effacer la recherche"
              >
                <IconX width={14} height={14} />
              </button>
            )}
          </div>
          <select className="field w-auto" value={filters.status} onChange={(e) => update("status", e.target.value)}>
            <option value="tous">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="prepare">Préparé</option>
            <option value="partiel">Partiellement payé</option>
            <option value="paye">Payé en totalité</option>
            <option value="annule">Annulé</option>
          </select>
          <select className="field w-auto" value={filters.dateField} onChange={(e) => update("dateField", e.target.value)}>
            <option value="arrivee">Dates d'arrivée</option>
            <option value="depart">Dates de départ</option>
          </select>
          <input type="date" className="field w-auto" value={filters.from} onChange={(e) => update("from", e.target.value)} aria-label="Date de début" />
          <input type="date" className="field w-auto" value={filters.to} onChange={(e) => update("to", e.target.value)} aria-label="Date de fin" />
          <Button variant="ghost" size="sm" icon={<IconRefresh width={14} height={14} />} onClick={() => reload()}>
            Actualiser
          </Button>
          <Link href="/sejours/nouveau" className="btn btn-accent btn-sm">
            <IconPlus width={14} height={14} />
            Nouveau séjour
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-overlay px-4 py-3">
          <Segmented
            size="sm"
            value={filters.sort}
            onChange={(v) => update("sort", v)}
            options={[
              { value: "recent", label: "Récents" },
              { value: "arrivee", label: "Arrivée" },
              { value: "depart", label: "Départ" },
              { value: "montant", label: "Montant" },
              { value: "solde", label: "Solde" },
              { value: "client", label: "Client" },
            ]}
          />
          <label className="flex cursor-pointer items-center gap-2 text-[0.8rem] font-semibold text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#126552]"
              checked={filters.unpaid}
              onChange={(e) => update("unpaid", e.target.checked)}
            />
            Soldes ouverts uniquement
          </label>
          {activeFilters && (
            <Button size="sm" variant="ghost" icon={<IconX width={13} height={13} />} onClick={() => { setFilters(DEFAULT_FILTERS); setDebounced(""); }}>
              Réinitialiser
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {views.map((view) => (
              <span key={view.name} className="chip border border-line-strong bg-surface text-ink-soft">
                <button type="button" className="font-bold hover:text-palm" onClick={() => { setFilters(view.filters); setDebounced(view.filters.q); }}>
                  <IconFilter width={11} height={11} />
                  {view.name}
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-danger"
                  aria-label={`Supprimer la vue ${view.name}`}
                  onClick={() => setViews(views.filter((v) => v.name !== view.name))}
                >
                  <IconX width={11} height={11} />
                </button>
              </span>
            ))}
            <Button size="sm" variant="ghost" icon={<IconSave width={13} height={13} />} onClick={() => setSaveViewOpen(true)}>
              Enregistrer la vue
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2.5 text-[0.78rem] text-muted">
          <span>
            <strong className="text-ink">{stays.length}</strong> document(s)
          </span>
          <span>
            Total filtré : <strong className="tabular text-ink">{formatMoney(totals.montant)}</strong>
          </span>
          <span>
            Solde à encaisser : <strong className="tabular text-terre">{formatMoney(totals.solde)}</strong>
          </span>
          <span>
            Nuits : <strong className="tabular text-ink">{totals.nuits}</strong>
          </span>
          <a href="/api/export?type=stays" className="btn btn-ghost btn-sm ml-auto">
            <IconDownload width={13} height={13} />
            Exporter tout (CSV)
          </a>
        </div>

        {selection.length > 0 && (
          <div className="anim-rise flex flex-wrap items-center gap-2 border-t border-line bg-nuit px-4 py-2.5 text-[#e9f3ed]">
            <span className="text-[0.82rem] font-bold">{selection.length} sélectionné(s)</span>
            <Button size="sm" variant="ghost" loading={busy} icon={<IconCheck width={13} height={13} />} onClick={bulkPrepare}>
              Marquer préparé
            </Button>
            <Button size="sm" variant="ghost" icon={<IconDownload width={13} height={13} />} onClick={exportSelection}>
              Exporter la sélection
            </Button>
            <Button size="sm" variant="danger" icon={<IconAlert width={13} height={13} />} onClick={() => setBulkCancel(true)}>
              Annuler les documents
            </Button>
            <button type="button" className="ml-auto text-[0.78rem] underline" onClick={() => setSelection([])}>
              Tout désélectionner
            </button>
          </div>
        )}

        {loading && !data ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : stays.length === 0 ? (
          <EmptyState
            icon={<IconFile width={22} height={22} />}
            title={activeFilters ? "Aucun document ne correspond" : "Aucun séjour enregistré"}
            message={
              activeFilters
                ? "Élargissez la recherche ou réinitialisez les filtres pour retrouver un dossier."
                : "Créez le premier séjour : le calcul des nuits, des services et du solde est automatique."
            }
            action={
              activeFilters ? (
                <Button variant="ghost" onClick={() => { setFilters(DEFAULT_FILTERS); setDebounced(""); }}>
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Link href="/sejours/nouveau" className="btn btn-primary">
                  <IconPlus width={15} height={15} />
                  Nouveau séjour
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-left text-[0.85rem]">
              <thead className="bg-overlay text-[0.7rem] uppercase tracking-[0.07em] text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#126552]"
                      checked={allSelected}
                      onChange={(e) => setSelection(e.target.checked ? stays.map((s) => s.id) : [])}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-bold">Identifiant</th>
                  <th className="cursor-pointer px-3 py-2.5 font-bold" onClick={() => toggleSort("client")}>
                    Client{sortArrow("client")}
                  </th>
                  <th className="cursor-pointer px-3 py-2.5 font-bold" onClick={() => toggleSort("arrivee")}>
                    Séjour{sortArrow("arrivee")}
                  </th>
                  <th className="px-3 py-2.5 font-bold">Statut</th>
                  <th className="cursor-pointer px-3 py-2.5 text-right font-bold" onClick={() => toggleSort("montant")}>
                    Total{sortArrow("montant")}
                  </th>
                  <th className="cursor-pointer px-3 py-2.5 text-right font-bold" onClick={() => toggleSort("solde")}>
                    Solde{sortArrow("solde")}
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stays.map((stay) => (
                  <tr key={stay.id} className={cn("row-hover border-t border-line", selection.includes(stay.id) && "bg-overlay")}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#126552]"
                        checked={selection.includes(stay.id)}
                        onChange={(e) =>
                          setSelection((list) => (e.target.checked ? [...list, stay.id] : list.filter((id) => id !== stay.id)))
                        }
                        aria-label={`Sélectionner ${stay.number}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setDrawerStay(stay)} className="font-bold text-palm hover:underline">
                        {stay.number}
                      </button>
                      {stay.isDemo && <span className="ml-1.5 text-[0.65rem] font-bold uppercase text-or">démo</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{stay.client.name}</p>
                      <p className="text-[0.73rem] text-muted">{stay.client.phone || "Téléphone non renseigné"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-ink">
                        {frDate(stay.arrivalDate)} → {frDate(stay.departureDate)}
                      </p>
                      <p className="text-[0.73rem] text-muted">
                        {stay.nights} nuit(s) · {stay.roomLabel || "chambre non précisée"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={stay.status} />
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-semibold">{formatMoney(stay.totals.total)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-bold">
                      {stay.status === "annule" ? (
                        <span className="text-muted">—</span>
                      ) : stay.balance.solde > 0 ? (
                        <span className="text-terre">{formatMoney(stay.balance.solde)}</span>
                      ) : stay.balance.tropPercu > 0 ? (
                        <span className="text-warning">−{formatMoney(stay.balance.tropPercu)}</span>
                      ) : (
                        <span className="text-success">0 FCFA</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {stay.status !== "annule" && stay.balance.solde > 0 && (
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted transition hover:bg-[rgba(22,130,93,0.12)] hover:text-success"
                            onClick={() => setCashStay(stay)}
                            title="Enregistrer un paiement"
                          >
                            <IconWallet width={15} height={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
                          onClick={() => setDrawerStay(stay)}
                          title="Aperçu rapide"
                        >
                          <IconEye width={15} height={15} />
                        </button>
                        <Link
                          href={`/sejours/${stay.id}`}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
                          title="Ouvrir le dossier"
                        >
                          <IconArrowRight width={15} height={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={Boolean(drawerStay)}
        onClose={() => setDrawerStay(null)}
        title={drawerStay ? drawerStay.client.name : ""}
        subtitle={
          drawerStay ? (
            <span className="flex flex-wrap items-center gap-2">
              <strong className="text-ink">{drawerStay.number}</strong>
              <StatusBadge status={drawerStay.status} />
              <span>{relativeDay(drawerStay.arrivalDate)}</span>
            </span>
          ) : null
        }
        footer={
          drawerStay ? (
            <>
              <Link href={`/sejours/${drawerStay.id}`} className="btn btn-primary">
                Ouvrir le dossier complet
                <IconArrowRight width={15} height={15} />
              </Link>
              {drawerStay.status !== "annule" && (
                <Button
                  variant="ghost"
                  icon={<IconWallet width={15} height={15} />}
                  onClick={() => {
                    setCashStay(drawerStay);
                    setDrawerStay(null);
                  }}
                >
                  Encaisser
                </Button>
              )}
              {drawerStay.lifecycle !== "annule" && (
                <Link href={`/sejours/${drawerStay.id}/modifier`} className="btn btn-ghost">
                  Modifier
                </Link>
              )}
            </>
          ) : null
        }
      >
        {drawerStay && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Arrivée", value: `${frDate(drawerStay.arrivalDate)} · ${drawerStay.arrivalTime}` },
                { label: "Départ", value: `${frDate(drawerStay.departureDate)} · ${drawerStay.departureTime}` },
                { label: "Chambre", value: drawerStay.roomLabel || "Non précisée" },
                { label: "Nuits / chambres", value: `${drawerStay.nights} nuit(s) · ${drawerStay.roomCount} chambre(s)` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-line bg-surface p-3">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">{item.label}</p>
                  <p className="mt-1 text-[0.86rem] font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="panel overflow-hidden">
              <div className="border-b border-line bg-overlay px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">
                Montants
              </div>
              <ul className="divide-y divide-line text-[0.85rem]">
                <li className="flex justify-between px-4 py-2">
                  <span className="text-muted">Hébergement</span>
                  <span className="tabular font-semibold">{formatMoney(drawerStay.totals.hebergement)}</span>
                </li>
                {drawerStay.services.map((service) => (
                  <li key={service.id} className="flex justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 truncate text-muted">
                      {service.description} × {service.quantity}
                    </span>
                    <span className="tabular font-semibold">{formatMoney(lineAmount(service))}</span>
                  </li>
                ))}
                {drawerStay.totals.remise > 0 && (
                  <li className="flex justify-between px-4 py-2 text-success">
                    <span>Remise</span>
                    <span className="tabular font-semibold">−{formatMoney(drawerStay.totals.remise)}</span>
                  </li>
                )}
                <li className="flex justify-between bg-overlay px-4 py-2.5">
                  <span className="font-bold">Total</span>
                  <span className="tabular font-display text-base font-bold text-palm">
                    {formatMoney(drawerStay.totals.total)}
                  </span>
                </li>
                <li className="flex justify-between px-4 py-2">
                  <span className="text-muted">Reçu</span>
                  <span className="tabular font-semibold text-success">{formatMoney(drawerStay.balance.net)}</span>
                </li>
                <li className="flex justify-between px-4 py-2">
                  <span className="font-bold">
                    {drawerStay.balance.tropPercu > 0 ? "Remboursable" : "Solde dû"}
                  </span>
                  <span className={cn("tabular font-bold", drawerStay.balance.solde > 0 ? "text-terre" : "text-success")}>
                    {formatMoney(drawerStay.balance.tropPercu > 0 ? drawerStay.balance.tropPercu : drawerStay.balance.solde)}
                  </span>
                </li>
              </ul>
            </div>

            {drawerStay.notes && <Notice tone="palm" title="Notes internes">{drawerStay.notes}</Notice>}
            {drawerStay.status === "annule" && (
              <Notice tone="danger" title="Document annulé">{drawerStay.cancelReason}</Notice>
            )}

            <div className="panel overflow-hidden">
              <div className="border-b border-line bg-overlay px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">
                Paiements ({drawerStay.payments.length})
              </div>
              {drawerStay.payments.length === 0 ? (
                <p className="px-4 py-4 text-[0.82rem] text-muted">Aucun paiement enregistré.</p>
              ) : (
                <ul className="divide-y divide-line text-[0.84rem]">
                  {drawerStay.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="text-muted">
                        {frDate(payment.paidOn)} · {payment.method}
                      </span>
                      <span className={cn("tabular font-semibold", payment.kind === "remboursement" && "text-danger")}>
                        {payment.kind === "remboursement" ? "− " : ""}
                        {formatMoney(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <PaymentDialog
        open={Boolean(cashStay)}
        stay={cashStay}
        methods={settings.paymentMethods}
        onClose={() => setCashStay(null)}
        onSaved={(updated) => {
          setData((current) =>
            current ? { stays: current.stays.map((s) => (s.id === updated.id ? updated : s)) } : current,
          );
          push({ tone: "success", title: "Paiement enregistré", message: `${updated.number} · solde ${formatMoney(updated.balance.solde)}` });
          void reload(true);
        }}
      />

      <Modal
        open={bulkCancel}
        onClose={() => setBulkCancel(false)}
        title={`Annuler ${selection.length} document(s)`}
        subtitle="Les documents sont conservés et marqués « annulé »."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkCancel(false)}>Revenir</Button>
            <Button variant="danger" loading={busy} disabled={!bulkReason.trim()} onClick={bulkCancelDocuments}>
              Confirmer l'annulation
            </Button>
          </>
        }
      >
        <Field label="Motif commun d'annulation" required>
          <textarea className="field min-h-[80px]" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Ex. doublons de saisie du 12/03" />
        </Field>
      </Modal>

      <Modal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Enregistrer cette vue"
        subtitle="Les filtres actuels seront réutilisables en un clic (sur ce poste)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={!viewName.trim()}
              onClick={() => {
                const next = [...views.filter((v) => v.name !== viewName.trim()), { name: viewName.trim(), filters }];
                setViews(next);
                setViewName("");
                setSaveViewOpen(false);
                push({ tone: "success", title: "Vue enregistrée" });
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <Field label="Nom de la vue" required>
          <input className="field" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Ex. Départs de la semaine" />
        </Field>
        <div className="mt-3">
          <Toggle
            checked={filters.unpaid}
            onChange={(v) => update("unpaid", v)}
            label="Limiter aux soldes ouverts"
            hint="Pratique pour préparer les encaissements du jour."
          />
        </div>
      </Modal>
    </div>
  );
}
