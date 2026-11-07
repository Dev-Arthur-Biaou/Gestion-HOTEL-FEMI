"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CashflowChart, MethodsChart, Sparkline } from "@/components/charts";
import {
  IconArrowRight,
  IconBed,
  IconCheck,
  IconClock,
  IconFile,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconSun,
  IconWallet,
} from "@/components/icons";
import { PaymentDialog } from "@/components/payment-dialog";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import {
  Button,
  EmptyState,
  ErrorState,
  Money,
  SectionTitle,
  SkeletonBlock,
  StatusBadge,
  Tag,
  cn,
} from "@/components/ui";
import { useResource } from "@/lib/hooks";
import { frDate, frDayMonth, relativeDay } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import type { DashboardDTO, StayDTO } from "@/lib/types";

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  delay,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: string;
  delay: number;
  children?: ReactNode;
}) {
  return (
    <article
      className="panel anim-rise relative overflow-hidden p-5"
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.16] blur-xl"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.13em] text-muted">{label}</p>
        <span
          className="grid h-9 w-9 place-items-center rounded-xl text-white"
          style={{ background: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-[1.75rem] font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[0.76rem] leading-snug text-muted">{hint}</p>
      {children}
    </article>
  );
}

function StayLine({
  stay,
  kind,
  onCash,
}: {
  stay: StayDTO;
  kind: "arrivee" | "depart" | "simple";
  onCash: (stay: StayDTO) => void;
}) {
  return (
    <li className="row-hover flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-overlay text-[0.72rem] font-bold text-palm">
        {kind === "simple" ? <IconFile width={16} height={16} /> : kind === "arrivee" ? stay.arrivalTime : stay.departureTime}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/sejours/${stay.id}`} className="block truncate text-[0.88rem] font-bold text-ink hover:text-palm">
          {stay.client.name}
        </Link>
        <p className="truncate text-[0.73rem] text-muted">
          {stay.number} · {stay.roomLabel || "Chambre non précisée"} · {stay.nights} nuit
          {stay.nights > 1 ? "s" : ""}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        {stay.balance.solde > 0 ? (
          <Money value={stay.balance.solde} className="block text-[0.84rem] font-bold text-terre" />
        ) : (
          <span className="block text-[0.78rem] font-bold text-success">Soldé</span>
        )}
        <StatusBadge status={stay.status} className="mt-1" />
      </div>
      {stay.balance.solde > 0 && stay.status !== "annule" && (
        <Button size="sm" variant="ghost" onClick={() => onCash(stay)} title="Enregistrer un paiement">
          <IconWallet width={14} height={14} />
        </Button>
      )}
      <Link
        href={`/sejours/${stay.id}`}
        className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
        aria-label={`Ouvrir le dossier ${stay.number}`}
      >
        <IconArrowRight width={16} height={16} />
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useResource<DashboardDTO>("/api/dashboard");
  const { settings } = useSettings();
  const { push } = useToast();
  const [cashStay, setCashStay] = useState<StayDTO | null>(null);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-28 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <SkeletonBlock className="h-80 rounded-2xl" />
          <SkeletonBlock className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="space-y-5">
      <section
        className="anim-rise relative overflow-hidden rounded-3xl border border-line bg-nuit px-6 py-6 text-[#e9f3ed] sm:px-8"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 5% 0%, rgba(43,154,124,0.4), transparent 60%), radial-gradient(520px 320px at 95% 100%, rgba(191,81,39,0.35), transparent 60%)",
        }}
      >
        <div className="mudcloth pointer-events-none absolute inset-y-0 right-0 w-64 opacity-30" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-or-soft">
              {frDate(data.today, "long")}
            </p>
            <h2 className="mt-2 font-display text-[2rem] font-semibold leading-tight text-[#fdf6e8]">
              {data.arrivals.length} arrivée{data.arrivals.length > 1 ? "s" : ""} ·{" "}
              {data.departures.length} départ{data.departures.length > 1 ? "s" : ""} ·{" "}
              {data.inHouse.length} séjour{data.inHouse.length > 1 ? "s" : ""} en cours
            </h2>
            <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[#b6d3c7]">
              Vue de travail de la réception. Ces montants sont des repères internes, ils ne
              constituent pas une comptabilité certifiée.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sejours/nouveau" className="btn btn-accent">
              <IconPlus width={16} height={16} />
              Préparer un séjour
            </Link>
            <button
              type="button"
              className="btn btn-ghost border-[rgba(253,246,232,0.25)] bg-[rgba(253,246,232,0.1)] text-[#e9f3ed] hover:bg-[rgba(253,246,232,0.18)] hover:text-white"
              onClick={() => reload(true)}
            >
              <IconRefresh width={15} height={15} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Encaissé aujourd'hui"
          value={formatMoney(t.encaisseJour)}
          hint={`${formatMoney(t.encaisseMois)} depuis le 1er du mois`}
          icon={<IconWallet width={17} height={17} />}
          accent="linear-gradient(135deg,#2b9a7c,#126552)"
          delay={0}
        >
          <div className="mt-2 -mb-1">
            <Sparkline values={data.cashflow.map((c) => c.amount)} color="#2b9a7c" />
          </div>
        </KpiCard>
        <KpiCard
          label="Soldes restant dus"
          value={formatMoney(t.soldeTotal)}
          hint={`${data.unpaid.length} dossier(s) avec un solde ouvert`}
          icon={<IconClock width={17} height={17} />}
          accent="linear-gradient(135deg,#e0743f,#bf5127)"
          delay={70}
        />
        <KpiCard
          label="Nuits du mois"
          value={formatNumber(t.nuitsMois)}
          hint={`${data.inHouse.length} séjour(s) en cours en ce moment`}
          icon={<IconMoon width={17} height={17} />}
          accent="linear-gradient(135deg,#dda118,#c07708)"
          delay={140}
        />
        <KpiCard
          label="Documents à suivre"
          value={formatNumber(t.documentsOuverts)}
          hint={`${t.brouillons} brouillon(s) · ${formatMoney(t.tropPercu)} de trop-perçu`}
          icon={<IconFile width={17} height={17} />}
          accent="linear-gradient(135deg,#2f6fed,#1c47a8)"
          delay={210}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "120ms" }}>
            <SectionTitle
              title="Mouvement du jour"
              subtitle="Arrivées et départs prévus aujourd'hui"
              icon={<IconSun width={17} height={17} />}
              action={
                <Link href="/sejours" className="btn btn-ghost btn-sm">
                  Tous les séjours
                  <IconArrowRight width={14} height={14} />
                </Link>
              }
            />
            <div className="grid md:grid-cols-2">
              <div className="border-b border-line md:border-b-0 md:border-r">
                <p className="flex items-center gap-2 bg-overlay px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-palm">
                  <IconBed width={14} height={14} /> Arrivées ({data.arrivals.length})
                </p>
                {data.arrivals.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[0.82rem] text-muted">
                    Aucune arrivée prévue aujourd'hui.
                  </p>
                ) : (
                  <ul>
                    {data.arrivals.map((stay) => (
                      <StayLine key={stay.id} stay={stay} kind="arrivee" onCash={setCashStay} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="flex items-center gap-2 bg-overlay px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-terre">
                  <IconClock width={14} height={14} /> Départs ({data.departures.length})
                </p>
                {data.departures.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[0.82rem] text-muted">
                    Aucun départ prévu aujourd'hui.
                  </p>
                ) : (
                  <ul>
                    {data.departures.map((stay) => (
                      <StayLine key={stay.id} stay={stay} kind="depart" onCash={setCashStay} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "160ms" }}>
            <SectionTitle
              title="Séjours en cours"
              subtitle="Clients présents à l'hôtel aujourd'hui"
              icon={<IconBed width={17} height={17} />}
            />
            {data.inHouse.length === 0 ? (
              <p className="px-5 py-6 text-center text-[0.84rem] text-muted">
                Aucun client n'est actuellement en cours de séjour.
              </p>
            ) : (
              <ul className="grid gap-3 p-4 sm:grid-cols-2">
                {data.inHouse.map((stay) => (
                  <li
                    key={stay.id}
                    className="rounded-2xl border border-line bg-overlay p-3.5 transition hover:border-palm"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/sejours/${stay.id}`}
                          className="block truncate text-[0.88rem] font-bold text-ink hover:text-palm"
                        >
                          {stay.client.name}
                        </Link>
                        <p className="truncate text-[0.73rem] text-muted">
                          {stay.roomLabel || "Chambre non précisée"} · {stay.guestCount} client
                          {stay.guestCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <StatusBadge status={stay.status} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.75rem]">
                      <Tag tone="palm">
                        <IconMoon width={11} height={11} />
                        {stay.nights} nuit{stay.nights > 1 ? "s" : ""}
                      </Tag>
                      <span className="text-muted">
                        Départ {relativeDay(stay.departureDate, data.today).toLowerCase()}
                      </span>
                      <span
                        className={cn(
                          "tabular ml-auto font-bold",
                          stay.balance.solde > 0 ? "text-terre" : "text-success",
                        )}
                      >
                        {stay.balance.solde > 0 ? formatMoney(stay.balance.solde) : "Soldé"}
                      </span>
                      {stay.balance.solde > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setCashStay(stay)}>
                          <IconWallet width={13} height={13} />
                          Encaisser
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "180ms" }}>
            <SectionTitle
              title="Paiements en attente"
              subtitle="Soldes les plus élevés, tous séjours confondus"
              icon={<IconWallet width={17} height={17} />}
              action={
                <Link href="/paiements" className="btn btn-ghost btn-sm">
                  Journal des paiements
                </Link>
              }
            />
            {data.unpaid.length === 0 ? (
              <EmptyState
                icon={<IconCheck width={22} height={22} />}
                title="Tous les séjours sont soldés"
                message="Aucun montant ne reste à encaisser sur les documents actifs. Les nouveaux séjours apparaîtront ici automatiquement."
              />
            ) : (
              <ul>
                {data.unpaid.map((stay) => (
                  <li key={stay.id} className="row-hover flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/sejours/${stay.id}`} className="truncate text-[0.88rem] font-bold text-ink hover:text-palm">
                        {stay.client.name}
                      </Link>
                      <p className="text-[0.73rem] text-muted">
                        {stay.number} · départ {frDate(stay.departureDate)} ({relativeDay(stay.departureDate, data.today)})
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={stay.balance.solde} className="block text-[0.95rem] font-bold text-terre" />
                      <span className="text-[0.7rem] text-muted">sur {formatMoney(stay.totals.total)}</span>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => setCashStay(stay)}>
                      <IconWallet width={14} height={14} />
                      Encaisser
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "150ms" }}>
            <SectionTitle
              title="Encaissements"
              subtitle={`14 derniers jours · ${frDayMonth(data.cashflow[0]?.date ?? data.today)} → aujourd'hui`}
            />
            <CashflowChart data={data.cashflow} />
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "200ms" }}>
            <SectionTitle title="Moyens de paiement" subtitle="Répartition du mois en cours" />
            <MethodsChart data={data.methods} />
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "240ms" }}>
            <SectionTitle
              title="À compléter"
              subtitle="Informations de l'hôtel manquantes"
              icon={<IconSettings width={17} height={17} />}
            />
            {data.missingSettings.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-5 text-[0.84rem] font-semibold text-success">
                <IconCheck width={16} height={16} />
                Toutes les informations de l'hôtel sont renseignées.
              </p>
            ) : (
              <div className="px-5 py-4">
                <ul className="space-y-1.5">
                  {data.missingSettings.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[0.82rem] text-ink-soft">
                      <span className="h-1.5 w-1.5 rounded-full bg-or" />
                      {item}
                      <Tag tone="or" className="ml-auto">
                        manquant
                      </Tag>
                    </li>
                  ))}
                </ul>
                <Link href="/parametres" className="btn btn-ghost btn-sm mt-3.5">
                  Ouvrir les paramètres
                  <IconArrowRight width={14} height={14} />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "260ms" }}>
        <SectionTitle
          title="Documents récemment créés"
          subtitle="Derniers identifiants internes attribués"
          icon={<IconFile width={17} height={17} />}
        />
        {data.recent.length === 0 ? (
          <EmptyState
            icon={<IconFile width={22} height={22} />}
            title="Aucun document pour l'instant"
            message="Créez un premier séjour : le numéro interne est attribué automatiquement et le document reste consultable à tout moment."
            action={
              <Link href="/sejours/nouveau" className="btn btn-primary">
                <IconPlus width={15} height={15} />
                Nouveau séjour
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-[0.84rem]">
              <thead className="bg-overlay text-[0.7rem] uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Identifiant</th>
                  <th className="px-4 py-2.5 font-bold">Client</th>
                  <th className="px-4 py-2.5 font-bold">Séjour</th>
                  <th className="px-4 py-2.5 font-bold">Statut</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total</th>
                  <th className="px-4 py-2.5 text-right font-bold">Solde</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((stay) => (
                  <tr key={stay.id} className="row-hover border-t border-line">
                    <td className="px-4 py-2.5">
                      <Link href={`/sejours/${stay.id}`} className="font-bold text-palm hover:underline">
                        {stay.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{stay.client.name}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {frDate(stay.arrivalDate)} → {frDate(stay.departureDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={stay.status} />
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-semibold text-ink">
                      {formatMoney(stay.totals.total)}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-bold">
                      {stay.balance.solde > 0 ? (
                        <span className="text-terre">{formatMoney(stay.balance.solde)}</span>
                      ) : stay.balance.tropPercu > 0 ? (
                        <span className="text-warning">−{formatMoney(stay.balance.tropPercu)}</span>
                      ) : (
                        <span className="text-success">0 FCFA</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PaymentDialog
        open={Boolean(cashStay)}
        stay={cashStay}
        methods={settings.paymentMethods}
        onClose={() => setCashStay(null)}
        onSaved={(stay) => {
          push({
            tone: "success",
            title: "Paiement enregistré",
            message: `${stay.number} · nouveau solde ${formatMoney(stay.balance.solde)}.`,
          });
          void reload(true);
        }}
      />
    </div>
  );
}
