"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IconDownload,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUndo,
  IconWallet,
} from "@/components/icons";
import { PaymentDialog } from "@/components/payment-dialog";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import {
  Button,
  EmptyState,
  ErrorState,
  Segmented,
  TableSkeleton,
  Tag,
  cn,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { addDays, frDate, todayISO } from "@/lib/dates";
import { useResource } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import type { PaymentDTO, StayDTO } from "@/lib/types";

export default function PaymentsPage() {
  const { settings } = useSettings();
  const { push } = useToast();
  const { data, setData, loading, error, reload } = useResource<{ payments: PaymentDTO[] }>("/api/payments");
  const { data: stayData } = useResource<{ stays: StayDTO[] }>("/api/stays?status=tous");

  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("tous");
  const [kind, setKind] = useState("tous");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("date");
  const [dialogOpen, setDialogOpen] = useState(false);

  const payments = useMemo(() => {
    const list = data?.payments ?? [];
    const q = query.trim().toLowerCase();
    const filtered = list.filter((p) => {
      if (method !== "tous" && p.method !== method) return false;
      if (kind !== "tous" && p.kind !== kind) return false;
      if (from && p.paidOn < from) return false;
      if (to && p.paidOn > to) return false;
      if (q) {
        const haystack = `${p.clientName ?? ""} ${p.stayNumber ?? ""} ${p.reference} ${p.note}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "montant") return b.amount - a.amount;
      return a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : b.id - a.id;
    });
  }, [data, query, method, kind, from, to, sort]);

  const stats = useMemo(() => {
    const received = payments.filter((p) => p.kind === "paiement").reduce((s, p) => s + p.amount, 0);
    const refunded = payments.filter((p) => p.kind === "remboursement").reduce((s, p) => s + p.amount, 0);
    const today = payments.filter((p) => p.paidOn === todayISO()).reduce((s, p) => s + (p.kind === "remboursement" ? -p.amount : p.amount), 0);
    return { received, refunded, net: received - refunded, today };
  }, [payments]);

  const methods = useMemo(() => {
    const set = new Set<string>(settings.paymentMethods);
    (data?.payments ?? []).forEach((p) => set.add(p.method));
    return [...set];
  }, [data, settings.paymentMethods]);

  const openStays = useMemo(
    () => (stayData?.stays ?? []).filter((s) => s.status !== "annule"),
    [stayData],
  );

  async function removePayment(payment: PaymentDTO) {
    setData((current) => (current ? { payments: current.payments.filter((p) => p.id !== payment.id) } : current));
    try {
      await api(`/api/payments/${payment.id}`, { method: "DELETE" });
      push({
        tone: "warning",
        title: "Paiement supprimé",
        message: `${formatMoney(payment.amount)} · ${payment.clientName ?? ""}`,
        action: {
          label: "Rétablir",
          onClick: async () => {
            try {
              await api("/api/payments", {
                method: "POST",
                body: JSON.stringify({
                  stayId: payment.stayId,
                  kind: payment.kind,
                  paidOn: payment.paidOn,
                  amount: payment.amount,
                  method: payment.method,
                  reference: payment.reference,
                  note: payment.note,
                  confirmOverpay: true,
                }),
              });
              void reload(true);
              push({ tone: "success", title: "Paiement rétabli" });
            } catch (err) {
              push({ tone: "error", title: "Rétablissement impossible", message: errorMessage(err) });
            }
          },
        },
      });
    } catch (err) {
      setData((current) => (current ? { payments: [...current.payments, payment] } : current));
      push({ tone: "error", title: "Suppression impossible", message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Encaissé (filtre actif)", value: formatMoney(stats.received), tone: "text-success" },
          { label: "Remboursé", value: formatMoney(stats.refunded), tone: "text-danger" },
          { label: "Net encaissé", value: formatMoney(stats.net), tone: "text-palm" },
          { label: "Aujourd'hui", value: formatMoney(stats.today), tone: "text-terre" },
        ].map((card, i) => (
          <article key={card.label} className="panel anim-rise p-4" style={{ ["--d" as string]: `${i * 60}ms` }}>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">{card.label}</p>
            <p className={cn("mt-1.5 font-display text-xl font-semibold", card.tone)}>{card.value}</p>
          </article>
        ))}
      </div>

      <section className="panel anim-rise overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <div className="relative min-w-[14rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch width={15} height={15} />
            </span>
            <input
              className="field pl-9"
              placeholder="Client, document, référence, note…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="field w-auto" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="tous">Tous les moyens</option>
            {methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input type="date" className="field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
          <input type="date" className="field w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
          <Button variant="ghost" size="sm" icon={<IconRefresh width={14} height={14} />} onClick={() => reload()}>
            Actualiser
          </Button>
          <Button variant="accent" size="sm" icon={<IconPlus width={14} height={14} />} onClick={() => setDialogOpen(true)}>
            Enregistrer un paiement
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-overlay px-4 py-3">
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "tous", label: "Tous" },
              { value: "paiement", label: "Paiements" },
              { value: "remboursement", label: "Remboursements" },
            ]}
          />
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: "date", label: "Par date" },
              { value: "montant", label: "Par montant" },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(todayISO()); setTo(todayISO()); }}>
              Aujourd'hui
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(addDays(todayISO(), -6)); setTo(todayISO()); }}>
              7 jours
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(`${todayISO().slice(0, 7)}-01`); setTo(todayISO()); }}>
              Mois en cours
            </button>
            {(from || to) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(""); setTo(""); }}>
                Toutes dates
              </button>
            )}
          </div>
          <a href="/api/export?type=payments" className="btn btn-ghost btn-sm ml-auto">
            <IconDownload width={13} height={13} />
            Exporter (CSV)
          </a>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<IconWallet width={22} height={22} />}
            title="Aucun paiement sur cette période"
            message="Enregistrez un acompte ou un règlement : le solde du séjour et le document sont mis à jour immédiatement."
            action={
              <Button variant="primary" icon={<IconPlus width={15} height={15} />} onClick={() => setDialogOpen(true)}>
                Enregistrer un paiement
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-[0.85rem]">
              <thead className="bg-overlay text-[0.7rem] uppercase tracking-[0.07em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Date</th>
                  <th className="px-4 py-2.5 font-bold">Document</th>
                  <th className="px-4 py-2.5 font-bold">Client</th>
                  <th className="px-4 py-2.5 font-bold">Moyen</th>
                  <th className="px-4 py-2.5 font-bold">Référence / note</th>
                  <th className="px-4 py-2.5 text-right font-bold">Montant</th>
                  <th className="px-4 py-2.5 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="row-hover border-t border-line">
                    <td className="px-4 py-2.5 text-ink">{frDate(payment.paidOn)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/sejours/${payment.stayId}`} className="font-bold text-palm hover:underline">
                        {payment.stayNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{payment.clientName}</td>
                    <td className="px-4 py-2.5">
                      <Tag tone={payment.kind === "remboursement" ? "terre" : "palm"}>
                        {payment.kind === "remboursement" && <IconUndo width={11} height={11} />}
                        {payment.method}
                      </Tag>
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5 text-muted">
                      {[payment.reference, payment.note].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={cn("tabular px-4 py-2.5 text-right font-bold", payment.kind === "remboursement" ? "text-danger" : "text-success")}>
                      {payment.kind === "remboursement" ? "− " : ""}
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removePayment(payment)}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                        title="Supprimer ce paiement (annulable)"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PaymentDialog
        open={dialogOpen}
        stay={null}
        options={openStays}
        methods={settings.paymentMethods}
        onClose={() => setDialogOpen(false)}
        onSaved={(stay) => {
          push({
            tone: "success",
            title: "Paiement enregistré",
            message: `${stay.number} · solde ${formatMoney(stay.balance.solde)}`,
          });
          void reload(true);
        }}
      />
    </div>
  );
}
