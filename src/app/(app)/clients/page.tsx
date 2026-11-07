"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IconArrowRight,
  IconEdit,
  IconMail,
  IconPhone,
  IconPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsers,
} from "@/components/icons";
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
  cn,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { frDate } from "@/lib/dates";
import { useResource } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import type { ClientDTO, StayDTO } from "@/lib/types";

type Draft = {
  name: string;
  phone: string;
  email: string;
  address: string;
  billingInfo: string;
  ifu: string;
  notes: string;
};

const EMPTY: Draft = { name: "", phone: "", email: "", address: "", billingInfo: "", ifu: "", notes: "" };

export default function ClientsPage() {
  const { data, setData, loading, error, reload } = useResource<{ clients: ClientDTO[] }>("/api/clients");
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("nom");
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDTO | null>(null);
  const [toDelete, setToDelete] = useState<ClientDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: history } = useResource<{ client: ClientDTO; stays: StayDTO[] }>(
    detail ? `/api/clients/${detail.id}` : null,
  );

  const clients = useMemo(() => {
    const list = data?.clients ?? [];
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const filtered = q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)),
        )
      : list;
    return [...filtered].sort((a, b) => {
      if (sort === "solde") return (b.totalBalance ?? 0) - (a.totalBalance ?? 0);
      if (sort === "sejours") return (b.stayCount ?? 0) - (a.stayCount ?? 0);
      return a.name.localeCompare(b.name, "fr");
    });
  }, [data, query, sort]);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(client: ClientDTO) {
    setEditing(client);
    setDraft({
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      billingInfo: client.billingInfo,
      ifu: client.ifu,
      notes: client.notes,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveClient() {
    if (!draft.name.trim()) {
      setFormError("Le nom du client est obligatoire.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const result = await api<{ client: ClientDTO }>(`/api/clients/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(draft),
        });
        setData((current) =>
          current
            ? {
                clients: current.clients.map((c) =>
                  c.id === editing.id ? { ...c, ...result.client } : c,
                ),
              }
            : current,
        );
        push({ tone: "success", title: "Fiche client mise à jour" });
      } else {
        await api("/api/clients", { method: "POST", body: JSON.stringify(draft) });
        push({ tone: "success", title: "Client enregistré", message: draft.name });
        void reload(true);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    if (!toDelete) return;
    setBusy(true);
    const snapshot = toDelete;
    setData((current) =>
      current ? { clients: current.clients.filter((c) => c.id !== snapshot.id) } : current,
    );
    try {
      await api(`/api/clients/${snapshot.id}`, { method: "DELETE" });
      setToDelete(null);
      setDetail(null);
      push({
        tone: "warning",
        title: "Fiche supprimée",
        message: snapshot.name,
        action: {
          label: "Rétablir la fiche",
          onClick: async () => {
            try {
              await api("/api/clients", {
                method: "POST",
                body: JSON.stringify({
                  name: snapshot.name,
                  phone: snapshot.phone,
                  email: snapshot.email,
                  address: snapshot.address,
                  billingInfo: snapshot.billingInfo,
                  ifu: snapshot.ifu,
                  notes: snapshot.notes,
                }),
              });
              void reload(true);
              push({ tone: "success", title: "Fiche rétablie" });
            } catch (err) {
              push({ tone: "error", title: "Rétablissement impossible", message: errorMessage(err) });
            }
          },
        },
      });
    } catch (err) {
      setData((current) => (current ? { clients: [...current.clients, snapshot] } : current));
      push({ tone: "error", title: "Suppression impossible", message: errorMessage(err) });
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel anim-rise overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <div className="relative min-w-[14rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch width={15} height={15} />
            </span>
            <input
              className="field pl-9"
              placeholder="Rechercher un client (nom, téléphone, e-mail)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: "nom", label: "Nom" },
              { value: "sejours", label: "Séjours" },
              { value: "solde", label: "Solde dû" },
            ]}
          />
          <Button variant="accent" size="sm" icon={<IconPlus width={14} height={14} />} onClick={openCreate}>
            Nouveau client
          </Button>
          <a href="/api/export?type=clients" className="btn btn-ghost btn-sm">
            Exporter (CSV)
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-overlay px-4 py-2.5 text-[0.78rem] text-muted">
          <span>
            <strong className="text-ink">{clients.length}</strong> fiche(s)
          </span>
          <span>
            Solde cumulé :{" "}
            <strong className="tabular text-terre">
              {formatMoney(clients.reduce((sum, c) => sum + (c.totalBalance ?? 0), 0))}
            </strong>
          </span>
          <span className="ml-auto">Seules les données utiles à la facturation sont demandées.</span>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<IconUsers width={22} height={22} />}
            title={query ? "Aucun client trouvé" : "Aucune fiche client"}
            message={
              query
                ? "Vérifiez l'orthographe ou créez une nouvelle fiche pour ce client."
                : "Les fiches sont créées automatiquement lors d'un nouveau séjour, ou manuellement ici."
            }
            action={
              <Button variant="primary" icon={<IconPlus width={15} height={15} />} onClick={openCreate}>
                Créer une fiche client
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[0.85rem]">
              <thead className="bg-overlay text-[0.7rem] uppercase tracking-[0.07em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Client</th>
                  <th className="px-4 py-2.5 font-bold">Contact</th>
                  <th className="px-4 py-2.5 text-center font-bold">Séjours</th>
                  <th className="px-4 py-2.5 text-right font-bold">Solde dû</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="row-hover border-t border-line">
                    <td className="px-4 py-3">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setDetail(client)}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-palm to-nuit-600 text-[0.85rem] font-bold text-white">
                          {client.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-ink hover:text-palm">{client.name}</span>
                          <span className="block text-[0.72rem] text-muted">
                            {client.ifu ? `IFU ${client.ifu}` : client.address || "Fiche minimale"}
                            {client.isDemo ? " · démo" : ""}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[0.8rem] text-muted">
                      <p className="flex items-center gap-1.5">
                        <IconPhone width={12} height={12} />
                        {client.phone || "non renseigné"}
                      </p>
                      {client.email && (
                        <p className="flex items-center gap-1.5">
                          <IconMail width={12} height={12} />
                          {client.email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Tag tone={client.stayCount ? "palm" : "neutral"}>{client.stayCount ?? 0}</Tag>
                    </td>
                    <td className={cn("tabular px-4 py-3 text-right font-bold", (client.totalBalance ?? 0) > 0 ? "text-terre" : "text-success")}>
                      {formatMoney(client.totalBalance ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
                          onClick={() => openEdit(client)}
                          title="Modifier la fiche"
                        >
                          <IconEdit width={15} height={15} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted transition hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                          onClick={() => setToDelete(client)}
                          title="Supprimer la fiche"
                        >
                          <IconTrash width={15} height={15} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
                          onClick={() => setDetail(client)}
                          title="Voir l'historique"
                        >
                          <IconArrowRight width={15} height={15} />
                        </button>
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
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={
          detail ? (
            <span className="flex flex-wrap items-center gap-3">
              {detail.phone && (
                <span className="flex items-center gap-1">
                  <IconPhone width={12} height={12} /> {detail.phone}
                </span>
              )}
              {detail.email && (
                <span className="flex items-center gap-1">
                  <IconMail width={12} height={12} /> {detail.email}
                </span>
              )}
              {detail.address && (
                <span className="flex items-center gap-1">
                  <IconPin width={12} height={12} /> {detail.address}
                </span>
              )}
            </span>
          ) : null
        }
        footer={
          detail ? (
            <>
              <Link href="/sejours/nouveau" className="btn btn-primary">
                <IconPlus width={15} height={15} />
                Nouveau séjour
              </Link>
              <Button variant="ghost" icon={<IconEdit width={15} height={15} />} onClick={() => openEdit(detail)}>
                Modifier la fiche
              </Button>
            </>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-surface p-3.5">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">Séjours</p>
                <p className="font-display text-xl font-semibold text-ink">{detail.stayCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-3.5">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">Solde dû</p>
                <p className={cn("font-display text-xl font-semibold", (detail.totalBalance ?? 0) > 0 ? "text-terre" : "text-success")}>
                  {formatMoney(detail.totalBalance ?? 0)}
                </p>
              </div>
            </div>

            {detail.billingInfo && <Notice tone="palm" title="Informations de facturation">{detail.billingInfo}</Notice>}
            {detail.notes && <Notice tone="info" title="Notes">{detail.notes}</Notice>}

            <div className="panel overflow-hidden">
              <div className="border-b border-line bg-overlay px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">
                Historique des séjours
              </div>
              {!history ? (
                <div className="p-4">
                  <TableSkeleton rows={3} />
                </div>
              ) : history.stays.length === 0 ? (
                <p className="px-4 py-6 text-center text-[0.84rem] text-muted">
                  Aucun séjour enregistré pour ce client.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {history.stays.map((stay) => (
                    <li key={stay.id} className="row-hover flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/sejours/${stay.id}`} className="font-bold text-palm hover:underline">
                          {stay.number}
                        </Link>
                        <p className="text-[0.75rem] text-muted">
                          {frDate(stay.arrivalDate)} → {frDate(stay.departureDate)} · {stay.roomLabel || "chambre"}
                        </p>
                      </div>
                      <StatusBadge status={stay.status} />
                      <span className="tabular text-[0.85rem] font-bold">{formatMoney(stay.totals.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Modifier la fiche client" : "Nouveau client"}
        subtitle="Renseignez uniquement ce qui est utile : le nom suffit pour ouvrir un dossier."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saving} onClick={saveClient}>
              {editing ? "Enregistrer" : "Créer la fiche"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom / raison sociale" required className="sm:col-span-2">
            <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className="field" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+229 …" />
          </Field>
          <Field label="E-mail (facultatif)">
            <input className="field" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <Field label="Adresse (facultatif)" className="sm:col-span-2">
            <input className="field" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </Field>
          <Field label="Informations de facturation" className="sm:col-span-2">
            <input className="field" value={draft.billingInfo} onChange={(e) => setDraft({ ...draft, billingInfo: e.target.value })} />
          </Field>
          <Field label="IFU du client (si fourni)">
            <input className="field" value={draft.ifu} onChange={(e) => setDraft({ ...draft, ifu: e.target.value })} />
          </Field>
          <Field label="Notes internes">
            <input className="field" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
        {formError && <div className="mt-4"><Notice tone="danger">{formError}</Notice></div>}
      </Modal>

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer cette fiche client"
        subtitle={toDelete?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Conserver</Button>
            <Button variant="danger" loading={busy} icon={<IconTrash width={15} height={15} />} onClick={deleteClient}>
              Supprimer
            </Button>
          </>
        }
      >
        <p className="text-[0.86rem] leading-relaxed text-ink-soft">
          La suppression n'est possible que si aucun séjour n'est rattaché à cette fiche. Les
          documents existants et leur historique ne sont jamais effacés par cette action.
        </p>
      </Modal>
    </div>
  );
}
