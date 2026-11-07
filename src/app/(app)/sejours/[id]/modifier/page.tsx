"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconEdit } from "@/components/icons";
import { StayForm } from "@/components/stay-form";
import { ErrorState, SkeletonBlock, StatusBadge, Tag } from "@/components/ui";
import { useResource } from "@/lib/hooks";
import type { StayDTO } from "@/lib/types";

export default function EditStayPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, reload } = useResource<{ stay: StayDTO }>(`/api/stays/${params.id}`);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-24 rounded-3xl" />
        <SkeletonBlock className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (error && !data) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data) return null;

  const stay = data.stay;

  if (stay.lifecycle === "annule") {
    return (
      <div className="panel p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">Document annulé</p>
        <p className="mx-auto mt-2 max-w-md text-[0.86rem] text-muted">
          Ce document a été annulé et reste consultable pour l'historique. Réactivez-le depuis la
          fiche du séjour pour pouvoir le modifier.
        </p>
        <Link href={`/sejours/${stay.id}`} className="btn btn-primary mt-4">
          Retour au dossier
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel anim-rise flex flex-wrap items-center gap-4 px-5 py-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(18,101,82,0.1)] text-palm">
          <IconEdit width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">
            Modifier le séjour {stay.number}
          </h2>
          <p className="mt-0.5 text-[0.85rem] text-muted">
            {stay.client.name} · le numéro interne et les paiements déjà enregistrés sont conservés.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={stay.status} />
          {stay.isDemo && <Tag tone="or">démo</Tag>}
        </div>
      </section>
      <StayForm initial={stay} />
    </div>
  );
}
