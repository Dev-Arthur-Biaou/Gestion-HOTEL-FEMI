"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Modal, Notice, Segmented } from "@/components/ui";
import { IconWallet } from "@/components/icons";
import { api, errorMessage, ApiClientError } from "@/lib/client";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PaymentDTO, StayDTO } from "@/lib/types";

export type PaymentDraft = {
  stayId: number;
  kind: "paiement" | "remboursement";
  paidOn: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
};

export function PaymentDialog({
  open,
  onClose,
  stay,
  options,
  methods,
  onSaved,
  onOptimistic,
  onRollback,
}: {
  open: boolean;
  onClose: () => void;
  stay: StayDTO | null;
  options?: StayDTO[];
  methods: string[];
  onSaved: (stay: StayDTO, payment: PaymentDTO) => void;
  onOptimistic?: (draft: PaymentDraft, tempId: number) => void;
  onRollback?: (tempId: number) => void;
}) {
  const [stayId, setStayId] = useState<number>(stay?.id ?? 0);
  const [kind, setKind] = useState<"paiement" | "remboursement">("paiement");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0] ?? "Espèces");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overpay, setOverpay] = useState<{ solde: number; excess: number } | null>(null);

  const selected = useMemo(
    () => (options ? options.find((s) => s.id === stayId) ?? stay : stay),
    [options, stayId, stay],
  );

  const stayKey = stay?.id ?? options?.[0]?.id ?? 0;
  const defaults = useRef({ methods, options });
  defaults.current = { methods, options };

  // Réinitialisation uniquement à l'ouverture (ou si l'on change de séjour) :
  // les mises à jour optimistes du parent ne doivent pas effacer la saisie.
  useEffect(() => {
    if (!open) return;
    setStayId(stayKey);
    setKind("paiement");
    setPaidOn(todayISO());
    setAmount("");
    setMethod(defaults.current.methods[0] ?? "Espèces");
    setReference("");
    setNote("");
    setError(null);
    setOverpay(null);
    setSaving(false);
  }, [open, stayKey]);

  if (!open) return null;

  const solde = selected?.balance.solde ?? 0;
  const value = Number(amount);

  async function save(confirmOverpay = false) {
    setError(null);
    if (!selected) {
      setError("Sélectionnez d'abord un séjour.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Montant invalide : saisissez un nombre supérieur à 0.");
      return;
    }
    if (kind === "remboursement" && value > selected.balance.net) {
      setError(
        `Remboursement supérieur au montant reçu (${formatMoney(selected.balance.net)}).`,
      );
      return;
    }
    const draft: PaymentDraft = {
      stayId: selected.id,
      kind,
      paidOn,
      amount: Math.round(value),
      method,
      reference: reference.trim(),
      note: note.trim(),
    };
    setSaving(true);
    const tempId = -Date.now();
    onOptimistic?.(draft, tempId);
    try {
      const result = await api<{ stay: StayDTO; payment: PaymentDTO }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ ...draft, confirmOverpay }),
      });
      onSaved(result.stay, result.payment);
      onClose();
    } catch (err) {
      onRollback?.(tempId);
      if (err instanceof ApiClientError && err.payload.code === "overpay") {
        setOverpay({
          solde: Number(err.payload.solde ?? 0),
          excess: Number(err.payload.excess ?? 0),
        });
        setError(null);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "remboursement" ? "Enregistrer un remboursement" : "Enregistrer un paiement"}
      subtitle={
        selected
          ? `${selected.number} · ${selected.client.name} · solde dû ${formatMoney(solde)}`
          : "Choisissez le séjour concerné"
      }
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          {overpay ? (
            <Button variant="accent" loading={saving} onClick={() => save(true)}>
              Confirmer le trop-perçu de {formatMoney(overpay.excess)}
            </Button>
          ) : (
            <Button variant="primary" loading={saving} icon={<IconWallet width={15} height={15} />} onClick={() => save(false)}>
              Enregistrer
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {options && options.length > 0 && (
          <Field label="Séjour concerné" required>
            <select
              className="field"
              value={stayId}
              onChange={(e) => {
                setStayId(Number(e.target.value));
                setOverpay(null);
              }}
            >
              <option value={0}>— Choisir un séjour —</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.number} · {option.client.name} · solde {formatMoney(option.balance.solde)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Segmented
          value={kind}
          onChange={(v) => {
            setKind(v);
            setOverpay(null);
          }}
          options={[
            { value: "paiement", label: "Paiement reçu" },
            { value: "remboursement", label: "Remboursement au client" },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <input type="date" className="field" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="Montant (FCFA)" required>
            <input
              type="number"
              min={1}
              step={100}
              className="field tabular"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setOverpay(null);
              }}
              placeholder="0"
            />
          </Field>
        </div>

        {selected && kind === "paiement" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAmount(String(solde))} disabled={solde <= 0}>
              Solder {formatMoney(solde)}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAmount(String(Math.round(solde / 2 / 100) * 100))}
              disabled={solde <= 0}
            >
              Moitié ({formatMoney(Math.round(solde / 2 / 100) * 100)})
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAmount(String(selected.totals.total))}>
              Total du séjour
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Moyen de paiement" required hint="Liste modifiable dans les paramètres.">
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Référence (facultatif)">
            <input
              className="field"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° de transaction, reçu…"
            />
          </Field>
        </div>

        <Field label="Note interne (facultative)">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Acompte à l'arrivée, solde au départ…"
          />
        </Field>

        {overpay && (
          <Notice tone="warning" title="Montant supérieur au solde dû">
            Le solde de ce séjour est de {formatMoney(overpay.solde)}. En confirmant, vous
            enregistrez un trop-perçu de {formatMoney(overpay.excess)} qui apparaîtra comme montant
            remboursable au client.
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {selected?.lifecycle === "brouillon" && kind === "paiement" && (
          <Notice tone="info">
            Ce document est un brouillon : il passera automatiquement au statut « préparé » dès
            l'enregistrement du paiement.
          </Notice>
        )}
      </div>
    </Modal>
  );
}
