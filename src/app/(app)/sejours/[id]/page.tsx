"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DocumentSheet, SheetFrame } from "@/components/document-sheet";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconDownload,
  IconEdit,
  IconEye,
  IconFile,
  IconPlus,
  IconPrinter,
  IconSave,
  IconTrash,
  IconUndo,
  IconWallet,
  IconX,
} from "@/components/icons";
import { PaymentDialog, type PaymentDraft } from "@/components/payment-dialog";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import {
  Button,
  ErrorState,
  Field,
  Modal,
  Money,
  Notice,
  SectionTitle,
  SkeletonBlock,
  StatusBadge,
  Tag,
  cn,
} from "@/components/ui";
import { api, downloadBlob, errorMessage } from "@/lib/client";
import { frDate, frTimestamp, relativeDay } from "@/lib/dates";
import { useResource } from "@/lib/hooks";
import { computeBalance, formatMoney, lineAmount, statusOf } from "@/lib/money";
import { generateStayPdf, pdfFilename } from "@/lib/pdf";
import type { StayDTO } from "@/lib/types";

export default function StayDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettings();
  const { push } = useToast();
  const { data, setData, loading, error, reload } = useResource<{ stay: StayDTO }>(
    `/api/stays/${params.id}`,
  );
  const stay = data?.stay ?? null;

  const [payOpen, setPayOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !stay) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <SkeletonBlock className="h-32 rounded-3xl" />
          <SkeletonBlock className="h-64 rounded-2xl" />
          <SkeletonBlock className="h-52 rounded-2xl" />
        </div>
        <SkeletonBlock className="h-[36rem] rounded-2xl" />
      </div>
    );
  }

  if (error && !stay) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!stay) return null;

  const applyOptimistic = (draft: PaymentDraft, tempId: number) => {
    setData((current) => {
      if (!current) return current;
      const payments = [
        ...current.stay.payments,
        {
          id: tempId,
          stayId: current.stay.id,
          kind: draft.kind,
          paidOn: draft.paidOn,
          amount: draft.amount,
          method: draft.method,
          reference: draft.reference,
          note: draft.note,
          createdAt: new Date().toISOString(),
        },
      ];
      const balance = computeBalance(current.stay.totals.total, payments);
      return {
        stay: {
          ...current.stay,
          payments,
          balance,
          status: statusOf(current.stay.lifecycle, current.stay.totals.total, balance.net),
        },
      };
    });
  };

  const rollback = (tempId: number) => {
    setData((current) => {
      if (!current) return current;
      const payments = current.stay.payments.filter((p) => p.id !== tempId);
      const balance = computeBalance(current.stay.totals.total, payments);
      return {
        stay: {
          ...current.stay,
          payments,
          balance,
          status: statusOf(current.stay.lifecycle, current.stay.totals.total, balance.net),
        },
      };
    });
  };

  async function runAction(action: string, reason?: string) {
    if (!stay) return;
    setBusy(action);
    setActionError(null);
    try {
      const result = await api<{ stay: StayDTO }>(`/api/stays/${stay.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      setData({ stay: result.stay });
      setCancelOpen(false);
      setCancelReason("");
      push({
        tone: action === "annuler" ? "warning" : "success",
        title:
          action === "annuler"
            ? "Document annulé"
            : action === "reactiver"
              ? "Document réactivé"
              : action === "preparer"
                ? "Document préparé"
                : "Statut mis à jour",
        message: `${result.stay.number} · historique conservé.`,
        action:
          action === "annuler"
            ? {
                label: "Annuler l'annulation",
                onClick: () => void runAction("reactiver"),
              }
            : undefined,
      });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function removePayment(paymentId: number) {
    if (!stay) return;
    const removed = stay.payments.find((p) => p.id === paymentId);
    if (!removed) return;
    rollback(paymentId);
    try {
      const result = await api<{ stay: StayDTO }>(`/api/payments/${paymentId}`, { method: "DELETE" });
      setData({ stay: result.stay });
      push({
        tone: "warning",
        title: "Paiement supprimé",
        message: `${formatMoney(removed.amount)} · ${removed.method}. La trace reste dans l'historique.`,
        action: {
          label: "Rétablir ce paiement",
          onClick: async () => {
            try {
              const restored = await api<{ stay: StayDTO }>("/api/payments", {
                method: "POST",
                body: JSON.stringify({
                  stayId: removed.stayId,
                  kind: removed.kind,
                  paidOn: removed.paidOn,
                  amount: removed.amount,
                  method: removed.method,
                  reference: removed.reference,
                  note: removed.note,
                  confirmOverpay: true,
                }),
              });
              setData({ stay: restored.stay });
              push({ tone: "success", title: "Paiement rétabli" });
            } catch (err) {
              push({ tone: "error", title: "Rétablissement impossible", message: errorMessage(err) });
            }
          },
        },
      });
    } catch (err) {
      setData({ stay });
      push({ tone: "error", title: "Suppression impossible", message: errorMessage(err) });
    }
  }

  async function downloadPdf() {
    if (!stay) return;
    setPdfBusy(true);
    try {
      const blob = await generateStayPdf(stay, settings);
      downloadBlob(blob, pdfFilename(stay), "application/pdf");
      push({ tone: "success", title: "PDF généré", message: pdfFilename(stay) });
    } catch (err) {
      push({
        tone: "error",
        title: "Échec de la génération du PDF",
        message: `${errorMessage(err)} — vos données restent enregistrées, réessayez ou utilisez l'impression.`,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  async function saveNotes() {
    if (!stay || notes === null) return;
    setBusy("notes");
    try {
      const result = await api<{ stay: StayDTO }>(`/api/stays/${stay.id}`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      setData({ stay: result.stay });
      setNotes(null);
      push({ tone: "success", title: "Notes internes enregistrées" });
    } catch (err) {
      push({ tone: "error", title: "Enregistrement impossible", message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function deleteDraft() {
    if (!stay) return;
    setBusy("delete");
    try {
      await api(`/api/stays/${stay.id}`, { method: "DELETE" });
      push({ tone: "warning", title: `Brouillon ${stay.number} supprimé`, message: "Le numéro reste réservé et ne sera pas réattribué." });
      router.push("/sejours");
    } catch (err) {
      setActionError(errorMessage(err));
      setDeleteOpen(false);
    } finally {
      setBusy(null);
    }
  }

  const t = stay.totals;

  return (
    <div className="space-y-5">
      <div className="anim-rise flex flex-wrap items-center gap-2 text-[0.8rem] text-muted">
        <Link href="/sejours" className="hover:text-palm">
          Séjours & documents
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink">{stay.number}</span>
        {stay.isDemo && <Tag tone="or">donnée de démonstration</Tag>}
      </div>

      <section
        className="panel anim-rise overflow-hidden"
        style={{ ["--d" as string]: "40ms" }}
      >
        <div className="flex flex-wrap items-start gap-4 border-b border-line bg-overlay px-5 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl font-semibold text-ink">{stay.client.name}</h2>
              <StatusBadge status={stay.status} />
            </div>
            <p className="mt-1 text-[0.85rem] text-muted">
              {stay.number} · {stay.roomLabel || "Chambre non précisée"} ·{" "}
              {frDate(stay.arrivalDate)} → {frDate(stay.departureDate)} · {stay.nights} nuit
              {stay.nights > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-[0.78rem] text-muted">
              Départ {relativeDay(stay.departureDate)} · créé le {frTimestamp(stay.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">Total du séjour</p>
            <p className="font-display text-2xl font-semibold text-palm">{formatMoney(t.total)}</p>
            <p className={cn("text-[0.82rem] font-bold", stay.balance.solde > 0 ? "text-terre" : stay.balance.tropPercu > 0 ? "text-warning" : "text-success")}>
              {stay.balance.tropPercu > 0
                ? `Remboursable ${formatMoney(stay.balance.tropPercu)}`
                : stay.balance.solde > 0
                  ? `Reste dû ${formatMoney(stay.balance.solde)}`
                  : "Séjour soldé"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3.5">
          {stay.status !== "annule" && (
            <Button variant="primary" icon={<IconWallet width={15} height={15} />} onClick={() => setPayOpen(true)}>
              Enregistrer un paiement
            </Button>
          )}
          <Button variant="accent" loading={pdfBusy} icon={<IconDownload width={15} height={15} />} onClick={downloadPdf}>
            Télécharger le PDF
          </Button>
          <Button variant="ghost" icon={<IconPrinter width={15} height={15} />} onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button variant="ghost" icon={<IconEye width={15} height={15} />} onClick={() => setPreviewOpen(true)}>
            Aperçu plein écran
          </Button>
          {stay.lifecycle !== "annule" && (
            <Link href={`/sejours/${stay.id}/modifier`} className="btn btn-ghost">
              <IconEdit width={15} height={15} />
              Modifier
            </Link>
          )}
          {stay.lifecycle === "brouillon" && (
            <Button variant="ghost" loading={busy === "preparer"} icon={<IconCheck width={15} height={15} />} onClick={() => runAction("preparer")}>
              Marquer comme préparé
            </Button>
          )}
          {stay.lifecycle === "prepare" && stay.payments.length === 0 && (
            <Button variant="ghost" loading={busy === "brouillon"} onClick={() => runAction("brouillon")}>
              Repasser en brouillon
            </Button>
          )}
          {stay.lifecycle === "annule" ? (
            <Button variant="ghost" loading={busy === "reactiver"} icon={<IconUndo width={15} height={15} />} onClick={() => runAction("reactiver")}>
              Réactiver le document
            </Button>
          ) : (
            <Button variant="danger" icon={<IconX width={15} height={15} />} onClick={() => setCancelOpen(true)}>
              Annuler le document
            </Button>
          )}
          {stay.lifecycle === "brouillon" && stay.payments.length === 0 && (
            <Button variant="ghost" icon={<IconTrash width={15} height={15} />} onClick={() => setDeleteOpen(true)}>
              Supprimer le brouillon
            </Button>
          )}
        </div>

        {(actionError || stay.status === "annule") && (
          <div className="space-y-2 px-5 pb-4">
            {actionError && <Notice tone="danger">{actionError}</Notice>}
            {stay.status === "annule" && (
              <Notice tone="danger" title="Document annulé — historique conservé">
                {stay.cancelReason || "Sans motif précisé"} · annulé le {frTimestamp(stay.cancelledAt)}
              </Notice>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "90ms" }}>
            <SectionTitle title="Détail des montants" subtitle="Calcul vérifiable, arrondi au FCFA" icon={<IconFile width={17} height={17} />} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-[0.85rem]">
                <thead className="bg-overlay text-[0.7rem] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">Désignation</th>
                    <th className="px-3 py-2.5 text-right font-bold">Qté</th>
                    <th className="px-3 py-2.5 text-right font-bold">P.U.</th>
                    <th className="px-5 py-2.5 text-right font-bold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="px-5 py-3">
                      <p className="font-bold text-ink">Hébergement</p>
                      <p className="text-[0.75rem] text-muted">
                        {stay.nights} nuit(s) × {stay.roomCount} chambre(s)
                      </p>
                    </td>
                    <td className="tabular px-3 py-3 text-right">{stay.nights * stay.roomCount}</td>
                    <td className="tabular px-3 py-3 text-right">{formatMoney(stay.nightlyRate)}</td>
                    <td className="tabular px-5 py-3 text-right font-bold">{formatMoney(t.hebergement)}</td>
                  </tr>
                  {stay.services.map((service) => (
                    <tr key={service.id} className="border-t border-line">
                      <td className="px-5 py-2.5">
                        <p className="font-semibold text-ink">{service.description}</p>
                        <p className="text-[0.73rem] text-muted">{service.category}</p>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{service.quantity}</td>
                      <td className="tabular px-3 py-2.5 text-right">{formatMoney(service.unitPrice)}</td>
                      <td className="tabular px-5 py-2.5 text-right font-semibold">{formatMoney(lineAmount(service))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-line bg-overlay px-5 py-4 text-[0.85rem]">
              <div className="flex justify-between">
                <dt className="text-muted">Sous-total services</dt>
                <dd className="tabular font-semibold">{formatMoney(t.servicesTotal)}</dd>
              </div>
              {t.remise > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Remise {stay.discountMode === "pourcentage" ? `(${stay.discountValue} %)` : ""}</dt>
                  <dd className="tabular font-semibold">−{formatMoney(t.remise)}</dd>
                </div>
              )}
              {stay.fees.map((fee, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-muted">
                    {fee.label} {fee.mode === "pourcentage" ? `(${fee.value} %)` : ""}
                  </dt>
                  <dd className="tabular font-semibold">
                    {formatMoney(
                      fee.mode === "pourcentage"
                        ? Math.round(((t.hebergement + t.servicesTotal - t.remise) * fee.value) / 100)
                        : fee.value,
                    )}
                  </dd>
                </div>
              ))}
              {t.taxe > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{stay.taxLabel || "Taxe"} ({stay.taxRate} %)</dt>
                  <dd className="tabular font-semibold">{formatMoney(t.taxe)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <dt className="font-bold">Total à payer</dt>
                <dd className="tabular font-display text-lg font-bold text-palm">{formatMoney(t.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Reçu (net des remboursements)</dt>
                <dd className="tabular font-semibold text-success">{formatMoney(stay.balance.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold">{stay.balance.tropPercu > 0 ? "Montant remboursable" : "Solde restant dû"}</dt>
                <dd className={cn("tabular font-bold", stay.balance.solde > 0 ? "text-terre" : stay.balance.tropPercu > 0 ? "text-warning" : "text-success")}>
                  <Money value={stay.balance.tropPercu > 0 ? stay.balance.tropPercu : stay.balance.solde} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "140ms" }}>
            <SectionTitle
              title="Acomptes et paiements"
              subtitle={`${stay.payments.length} mouvement(s) enregistré(s)`}
              icon={<IconWallet width={17} height={17} />}
              action={
                stay.status !== "annule" ? (
                  <Button size="sm" variant="ghost" icon={<IconPlus width={14} height={14} />} onClick={() => setPayOpen(true)}>
                    Ajouter
                  </Button>
                ) : undefined
              }
            />
            {stay.payments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[0.88rem] font-semibold text-ink">Aucun paiement enregistré</p>
                <p className="mx-auto mt-1 max-w-sm text-[0.8rem] text-muted">
                  Enregistrez un acompte dès l'arrivée : le solde se met à jour immédiatement sur le
                  document.
                </p>
                {stay.status !== "annule" && (
                  <Button variant="primary" className="mt-3" icon={<IconWallet width={15} height={15} />} onClick={() => setPayOpen(true)}>
                    Enregistrer le premier paiement
                  </Button>
                )}
              </div>
            ) : (
              <ul>
                {stay.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className={cn(
                      "row-hover flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0",
                      payment.id < 0 && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl",
                        payment.kind === "remboursement"
                          ? "bg-[rgba(191,58,43,0.12)] text-danger"
                          : "bg-[rgba(22,130,93,0.12)] text-success",
                      )}
                    >
                      {payment.kind === "remboursement" ? <IconUndo width={15} height={15} /> : <IconCheck width={15} height={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.88rem] font-bold text-ink">
                        {payment.kind === "remboursement" ? "− " : ""}
                        {formatMoney(payment.amount)}
                        <span className="ml-2 text-[0.76rem] font-semibold text-muted">{payment.method}</span>
                      </p>
                      <p className="truncate text-[0.74rem] text-muted">
                        {frDate(payment.paidOn)}
                        {payment.reference ? ` · réf. ${payment.reference}` : ""}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    {payment.id < 0 ? (
                      <Tag tone="info">enregistrement…</Tag>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removePayment(payment.id)}
                        className="rounded-lg p-2 text-muted transition hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                        aria-label="Supprimer ce paiement"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "180ms" }}>
            <SectionTitle title="Notes internes" subtitle="Non imprimées sur le document client" icon={<IconEdit width={17} height={17} />} />
            <div className="space-y-3 p-5">
              <textarea
                className="field min-h-[90px]"
                value={notes ?? stay.notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Consignes de la réception, préférences du client…"
              />
              {notes !== null && notes !== stay.notes && (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" loading={busy === "notes"} icon={<IconSave width={14} height={14} />} onClick={saveNotes}>
                    Enregistrer la note
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setNotes(null)}>
                    Abandonner
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "220ms" }}>
            <SectionTitle title="Historique du dossier" subtitle="Chaque action laisse une trace" icon={<IconClock width={17} height={17} />} />
            <ol className="space-y-3 p-5">
              {(stay.events ?? []).map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      event.kind === "annulation"
                        ? "bg-danger"
                        : event.kind === "paiement"
                          ? "bg-success"
                          : event.kind === "alerte"
                            ? "bg-warning"
                            : "bg-palm",
                    )}
                  />
                  <div className="min-w-0 flex-1 border-b border-line pb-2.5 last:border-0">
                    <p className="text-[0.84rem] text-ink">{event.message}</p>
                    <p className="text-[0.72rem] text-muted">{frTimestamp(event.createdAt)}</p>
                  </div>
                </li>
              ))}
              {(stay.events ?? []).length === 0 && (
                <li className="text-[0.82rem] text-muted">Aucun évènement enregistré.</li>
              )}
            </ol>
          </section>
        </div>

        <aside className="xl:sticky xl:top-32 xl:h-fit">
          <div className="panel anim-rise overflow-hidden" style={{ ["--d" as string]: "120ms" }}>
            <SectionTitle
              title="Aperçu du document"
              subtitle="Format A4 · mention interne obligatoire"
              icon={<IconEye width={17} height={17} />}
              action={
                <Button size="sm" variant="ghost" loading={pdfBusy} icon={<IconDownload width={14} height={14} />} onClick={downloadPdf}>
                  PDF
                </Button>
              }
            />
            <div className="max-h-[42rem] overflow-y-auto bg-sand p-3">
              <SheetFrame>
                <DocumentSheet stay={stay} settings={settings} />
              </SheetFrame>
            </div>
          </div>
        </aside>
      </div>

      {/* Zone imprimée : seule cette partie sort sur l'imprimante */}
      <div id="print-root" className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0">
        <DocumentSheet stay={stay} settings={settings} />
      </div>

      <PaymentDialog
        open={payOpen}
        stay={stay}
        methods={settings.paymentMethods}
        onClose={() => setPayOpen(false)}
        onOptimistic={applyOptimistic}
        onRollback={rollback}
        onSaved={(updated) => {
          setData({ stay: updated });
          push({
            tone: "success",
            title: "Paiement enregistré",
            message:
              updated.balance.tropPercu > 0
                ? `Trop-perçu de ${formatMoney(updated.balance.tropPercu)} à restituer.`
                : `Solde restant : ${formatMoney(updated.balance.solde)}.`,
          });
        }}
      />

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Document ${stay.number}`}
        subtitle="Vérifiez le document avant de l'imprimer ou de le transmettre"
        width="max-w-4xl"
        footer={
          <>
            <Button variant="ghost" icon={<IconPrinter width={15} height={15} />} onClick={() => window.print()}>
              Imprimer
            </Button>
            <Button variant="accent" loading={pdfBusy} icon={<IconDownload width={15} height={15} />} onClick={downloadPdf}>
              Télécharger le PDF
            </Button>
          </>
        }
      >
        <div className="bg-sand p-3">
          <SheetFrame>
            <DocumentSheet stay={stay} settings={settings} />
          </SheetFrame>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler ce document"
        subtitle="Le document est conservé avec la mention « annulé » : rien n'est effacé."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Revenir
            </Button>
            <Button
              variant="danger"
              loading={busy === "annuler"}
              icon={<IconAlert width={15} height={15} />}
              onClick={() => runAction("annuler", cancelReason)}
            >
              Confirmer l'annulation
            </Button>
          </>
        }
      >
        <Field label="Motif de l'annulation" required hint="Ex. erreur de saisie, client parti plus tôt, doublon…">
          <textarea className="field min-h-[90px]" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
        {stay.payments.length > 0 && (
          <div className="mt-3">
            <Notice tone="warning">
              {formatMoney(stay.balance.net)} ont déjà été encaissés sur ce séjour. Pensez à
              enregistrer le remboursement au client si nécessaire.
            </Notice>
          </div>
        )}
        {actionError && <div className="mt-3"><Notice tone="danger">{actionError}</Notice></div>}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer ce brouillon"
        subtitle="Seuls les brouillons sans paiement peuvent être supprimés."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Conserver
            </Button>
            <Button variant="danger" loading={busy === "delete"} icon={<IconTrash width={15} height={15} />} onClick={deleteDraft}>
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p className="text-[0.86rem] leading-relaxed text-ink-soft">
          Le document {stay.number} sera retiré de la liste. Son numéro interne ne sera jamais
          réattribué. Pour un document déjà préparé, utilisez plutôt « Annuler le document » afin de
          conserver l'historique.
        </p>
        <Link href="/sejours" className="btn btn-ghost mt-4">
          Retour à la liste
          <IconArrowRight width={14} height={14} />
        </Link>
      </Modal>
    </div>
  );
}
