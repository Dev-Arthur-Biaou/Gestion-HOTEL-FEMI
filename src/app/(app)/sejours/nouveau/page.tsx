"use client";

import Link from "next/link";
import { IconArrowRight, IconMoon, IconShield } from "@/components/icons";
import { StayForm } from "@/components/stay-form";
import { Tag } from "@/components/ui";
import { useSettings } from "@/components/settings-context";

export default function NewStayPage() {
  const { settings } = useSettings();
  return (
    <div className="space-y-5">
      <section className="panel anim-rise flex flex-wrap items-center gap-4 px-5 py-5">
        <span className="mudcloth grid h-12 w-12 place-items-center rounded-2xl border border-line text-palm">
          <IconMoon width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">Préparer un nouveau séjour</h2>
          <p className="mt-0.5 text-[0.85rem] text-muted">
            Renseignez le client, les dates et les services : les nuits, les montants et le solde se
            calculent au fur et à mesure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="palm">Numérotation {settings.docPrefix}-AAAA-0000</Tag>
          <Link href="/sejours" className="btn btn-ghost btn-sm">
            Voir les séjours
            <IconArrowRight width={14} height={14} />
          </Link>
        </div>
      </section>

      <StayForm />

      <p className="flex items-start gap-2 px-1 text-[0.76rem] leading-relaxed text-muted">
        <IconShield width={14} height={14} className="mt-0.5 shrink-0" />
        Le document produit est un document interne de préparation et de suivi. Il ne vaut pas
        facture normalisée : si une facture normalisée est nécessaire, elle doit être émise avec la
        solution officielle ou autorisée applicable.
      </p>
    </div>
  );
}
