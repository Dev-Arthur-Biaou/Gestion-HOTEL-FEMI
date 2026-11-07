"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { frDate, frDateTime } from "@/lib/dates";
import { INTERNAL_NOTICE, STATUS_LABEL, formatMoney, lineAmount } from "@/lib/money";
import type { SettingsDTO, StayDTO } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  brouillon: "#786d5c",
  prepare: "#2f6fed",
  partiel: "#c07708",
  paye: "#16825d",
  annule: "#bf3a2b",
};

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12mm",
        padding: "1.1mm 0",
        fontWeight: bold ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function DocumentSheet({ stay, settings }: { stay: StayDTO; settings: SettingsDTO }) {
  const prepared = stay.preparedAt ?? stay.createdAt;
  const preparedLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(prepared));

  return (
    <article className="sheet" style={{ fontFamily: "var(--font-sans)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "10mm", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "4mm", alignItems: "flex-start" }}>
          {settings.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt="" style={{ width: "20mm", height: "20mm", objectFit: "contain" }} />
          ) : null}
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "20pt", margin: 0, color: "#0e332b", lineHeight: 1.1 }}>
              {settings.hotelName}
            </h1>
            <div style={{ fontSize: "8.5pt", color: "#4a4438", marginTop: "1.5mm", lineHeight: 1.55 }}>
              <div>{settings.address || "Adresse : non renseignée"}</div>
              <div>
                {settings.phone ? `Tél. ${settings.phone}` : "Téléphone : non renseigné"}
                {settings.email ? ` · ${settings.email}` : ""}
              </div>
              <div style={{ color: "#786d5c" }}>Bénin · Devise : FCFA (XOF)</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: "62mm" }}>
          <div
            style={{
              display: "inline-block",
              border: "1px solid #cfbfa4",
              borderRadius: "3mm",
              padding: "3mm 4mm",
              background: "#fff8ee",
              textAlign: "left",
              width: "100%",
            }}
          >
            <div style={{ fontSize: "7.5pt", letterSpacing: "0.12em", textTransform: "uppercase", color: "#786d5c", fontWeight: 700 }}>
              Document interne de séjour
            </div>
            <div style={{ fontSize: "14pt", fontWeight: 700, color: "#bf5127", marginTop: "1mm" }}>{stay.number}</div>
            <div style={{ fontSize: "8.5pt", color: "#4a4438", marginTop: "1mm" }}>Préparé le {preparedLabel}</div>
            <div style={{ marginTop: "2mm", fontSize: "8.5pt", fontWeight: 700, color: STATUS_COLOR[stay.status] }}>
              ● {STATUS_LABEL[stay.status]}
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          marginTop: "5mm",
          border: "1px solid #dda118",
          background: "rgba(221,161,24,0.12)",
          borderRadius: "2mm",
          padding: "2.5mm 3mm",
          fontSize: "8.5pt",
          fontWeight: 700,
          color: "#7a5602",
        }}
      >
        {INTERNAL_NOTICE}
      </div>

      {stay.status === "annule" && (
        <div
          style={{
            marginTop: "3mm",
            border: "1px solid #bf3a2b",
            background: "rgba(191,58,43,0.08)",
            borderRadius: "2mm",
            padding: "2.5mm 3mm",
            fontSize: "9pt",
            fontWeight: 700,
            color: "#bf3a2b",
          }}
        >
          DOCUMENT ANNULÉ — {stay.cancelReason || "sans motif précisé"}
        </div>
      )}

      <section style={{ display: "flex", gap: "5mm", marginTop: "5mm" }}>
        <div style={{ flex: 1, border: "1px solid #e2d8c6", borderRadius: "2.5mm", padding: "3.5mm" }}>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.1em", color: "#786d5c", fontWeight: 700 }}>
            Client
          </div>
          <div style={{ fontSize: "11.5pt", fontWeight: 700, marginTop: "1.5mm" }}>{stay.client.name}</div>
          <div style={{ fontSize: "8.5pt", color: "#4a4438", lineHeight: 1.6, marginTop: "1mm" }}>
            {stay.client.phone && <div>Tél. {stay.client.phone}</div>}
            {stay.client.email && <div>{stay.client.email}</div>}
            {stay.client.address && <div>{stay.client.address}</div>}
            {stay.client.billingInfo && <div>{stay.client.billingInfo}</div>}
            {stay.client.ifu && <div>IFU client : {stay.client.ifu}</div>}
            {!stay.client.phone && !stay.client.email && <div>Coordonnées non renseignées</div>}
          </div>
        </div>

        <div style={{ flex: 1, border: "1px solid #e2d8c6", borderRadius: "2.5mm", padding: "3.5mm" }}>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.1em", color: "#786d5c", fontWeight: 700 }}>
            Séjour
          </div>
          <div style={{ fontSize: "11.5pt", fontWeight: 700, marginTop: "1.5mm" }}>
            {stay.roomLabel || "Chambre non précisée"}
          </div>
          <div style={{ fontSize: "8.5pt", color: "#4a4438", lineHeight: 1.6, marginTop: "1mm" }}>
            <div>Arrivée : {frDateTime(stay.arrivalDate, stay.arrivalTime)}</div>
            <div>Départ : {frDateTime(stay.departureDate, stay.departureTime)}</div>
            <div>
              {stay.nights} nuit{stay.nights > 1 ? "s" : ""} · {stay.roomCount} chambre
              {stay.roomCount > 1 ? "s" : ""} · {stay.guestCount} client{stay.guestCount > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "6mm" }}>
        <table style={{ fontSize: "9pt" }}>
          <thead>
            <tr style={{ background: "#0e332b", color: "#fdf6e8" }}>
              <th style={{ textAlign: "left", padding: "2.5mm 3mm", fontWeight: 700 }}>Désignation</th>
              <th style={{ textAlign: "right", padding: "2.5mm 2mm", fontWeight: 700, width: "18mm" }}>Qté</th>
              <th style={{ textAlign: "right", padding: "2.5mm 2mm", fontWeight: 700, width: "28mm" }}>P.U.</th>
              <th style={{ textAlign: "right", padding: "2.5mm 3mm", fontWeight: 700, width: "30mm" }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2d8c6" }}>
              <td style={{ padding: "2.5mm 3mm" }}>
                <strong>Hébergement — {stay.roomLabel || "chambre"}</strong>
                <div style={{ color: "#786d5c", fontSize: "8pt" }}>
                  {frDate(stay.arrivalDate)} → {frDate(stay.departureDate)} · {stay.nights} nuit(s) ×{" "}
                  {stay.roomCount} chambre(s)
                </div>
              </td>
              <td style={{ textAlign: "right", padding: "2.5mm 2mm" }}>{stay.nights * stay.roomCount}</td>
              <td style={{ textAlign: "right", padding: "2.5mm 2mm" }}>{formatMoney(stay.nightlyRate)}</td>
              <td style={{ textAlign: "right", padding: "2.5mm 3mm", fontWeight: 700 }}>
                {formatMoney(stay.totals.hebergement)}
              </td>
            </tr>
            {stay.services.map((service) => (
              <tr key={service.id} style={{ borderBottom: "1px solid #f0e9dd" }}>
                <td style={{ padding: "2.2mm 3mm" }}>
                  {service.description}
                  <div style={{ color: "#786d5c", fontSize: "8pt" }}>{service.category}</div>
                </td>
                <td style={{ textAlign: "right", padding: "2.2mm 2mm" }}>{service.quantity}</td>
                <td style={{ textAlign: "right", padding: "2.2mm 2mm" }}>{formatMoney(service.unitPrice)}</td>
                <td style={{ textAlign: "right", padding: "2.2mm 3mm", fontWeight: 600 }}>
                  {formatMoney(lineAmount(service))}
                </td>
              </tr>
            ))}
            {stay.services.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "2.5mm 3mm", color: "#786d5c", fontSize: "8.5pt" }}>
                  Aucun service supplémentaire facturé sur ce séjour.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ display: "flex", justifyContent: "flex-end", marginTop: "5mm" }}>
        <div style={{ width: "84mm", fontSize: "9pt" }}>
          <Line label="Hébergement" value={formatMoney(stay.totals.hebergement)} />
          <Line label="Services supplémentaires" value={formatMoney(stay.totals.servicesTotal)} />
          {stay.totals.remise > 0 && <Line label="Remise" value={`− ${formatMoney(stay.totals.remise)}`} />}
          {stay.fees.map((fee, i) => (
            <Line
              key={i}
              label={fee.label + (fee.mode === "pourcentage" ? ` (${fee.value} %)` : "")}
              value={formatMoney(
                fee.mode === "pourcentage"
                  ? Math.round(((stay.totals.hebergement + stay.totals.servicesTotal - stay.totals.remise) * fee.value) / 100)
                  : fee.value,
              )}
            />
          ))}
          <div style={{ borderTop: "1px solid #e2d8c6", marginTop: "1.5mm", paddingTop: "1.5mm" }}>
            <Line label="Sous-total" value={formatMoney(stay.totals.sousTotal)} />
          </div>
          {stay.totals.taxe > 0 && (
            <Line label={`${stay.taxLabel || "Taxe"} (${stay.taxRate} %)`} value={formatMoney(stay.totals.taxe)} />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              background: "#0e332b",
              color: "#fdf6e8",
              padding: "2.8mm 3mm",
              borderRadius: "2mm",
              marginTop: "2mm",
              fontWeight: 700,
              fontSize: "11pt",
            }}
          >
            <span>TOTAL À PAYER</span>
            <span>{formatMoney(stay.totals.total)}</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "6mm" }}>
        <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.1em", color: "#786d5c", fontWeight: 700, marginBottom: "2mm" }}>
          Acomptes et paiements
        </div>
        {stay.payments.length === 0 ? (
          <div style={{ fontSize: "9pt", color: "#786d5c", border: "1px dashed #cfbfa4", borderRadius: "2mm", padding: "3mm" }}>
            Aucun paiement enregistré à ce jour.
          </div>
        ) : (
          <table style={{ fontSize: "8.8pt" }}>
            <thead>
              <tr style={{ background: "#f3ede2" }}>
                <th style={{ textAlign: "left", padding: "2mm 3mm" }}>Date</th>
                <th style={{ textAlign: "left", padding: "2mm 3mm" }}>Moyen</th>
                <th style={{ textAlign: "left", padding: "2mm 3mm" }}>Référence / note</th>
                <th style={{ textAlign: "right", padding: "2mm 3mm", width: "32mm" }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {stay.payments.map((payment) => (
                <tr key={payment.id} style={{ borderBottom: "1px solid #f0e9dd" }}>
                  <td style={{ padding: "2mm 3mm" }}>{frDate(payment.paidOn, "short")}</td>
                  <td style={{ padding: "2mm 3mm" }}>
                    {payment.method}
                    {payment.kind === "remboursement" ? " (remboursement)" : ""}
                  </td>
                  <td style={{ padding: "2mm 3mm", color: "#786d5c" }}>
                    {[payment.reference, payment.note].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td
                    style={{
                      padding: "2mm 3mm",
                      textAlign: "right",
                      fontWeight: 600,
                      color: payment.kind === "remboursement" ? "#bf3a2b" : "#14120e",
                    }}
                  >
                    {payment.kind === "remboursement" ? "− " : ""}
                    {formatMoney(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "3mm" }}>
          <div style={{ width: "84mm", fontSize: "9pt" }}>
            <Line label="Total reçu" value={formatMoney(stay.balance.recu)} />
            {stay.balance.rembourse > 0 && (
              <Line label="Remboursé au client" value={`− ${formatMoney(stay.balance.rembourse)}`} />
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "2.6mm 3mm",
                borderRadius: "2mm",
                marginTop: "1.5mm",
                fontWeight: 700,
                fontSize: "10.5pt",
                background: stay.balance.solde > 0 ? "rgba(191,81,39,0.12)" : "rgba(22,130,93,0.12)",
                color: stay.balance.solde > 0 ? "#bf5127" : "#16825d",
                border: `1px solid ${stay.balance.solde > 0 ? "#bf5127" : "#16825d"}`,
              }}
            >
              <span>
                {stay.balance.tropPercu > 0
                  ? "MONTANT REMBOURSABLE"
                  : stay.balance.solde > 0
                    ? "SOLDE RESTANT DÛ"
                    : "SÉJOUR SOLDÉ"}
              </span>
              <span>
                {formatMoney(stay.balance.tropPercu > 0 ? stay.balance.tropPercu : stay.balance.solde)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {(settings.paymentInfo || settings.momoDetails || settings.bankDetails) && (
        <section style={{ marginTop: "5mm", fontSize: "8.5pt", border: "1px solid #e2d8c6", borderRadius: "2.5mm", padding: "3mm" }}>
          <div style={{ fontWeight: 700, marginBottom: "1mm", color: "#0e332b" }}>Coordonnées de paiement</div>
          {settings.paymentInfo && <div style={{ whiteSpace: "pre-line" }}>{settings.paymentInfo}</div>}
          {settings.momoDetails && <div style={{ whiteSpace: "pre-line" }}>Mobile Money : {settings.momoDetails}</div>}
          {settings.bankDetails && <div style={{ whiteSpace: "pre-line" }}>Banque : {settings.bankDetails}</div>}
        </section>
      )}

      <footer style={{ marginTop: "6mm", borderTop: "1px solid #e2d8c6", paddingTop: "3mm", fontSize: "7.8pt", color: "#786d5c", lineHeight: 1.55 }}>
        {settings.commercialNotes && (
          <div style={{ whiteSpace: "pre-line", color: "#4a4438", marginBottom: "1.5mm" }}>{settings.commercialNotes}</div>
        )}
        {settings.footerText && <div style={{ whiteSpace: "pre-line", marginBottom: "1.5mm" }}>{settings.footerText}</div>}
        <div>
          Numérotation interne {stay.number} — attribuée par le logiciel de l'hôtel, sans valeur
          fiscale. Si une facture normalisée doit être délivrée, elle doit être émise avec la solution
          officielle ou autorisée applicable (DGI Bénin).
        </div>
      </footer>
    </article>
  );
}

/** Cadre responsive : le document A4 est mis à l'échelle sans jamais être coupé. */
export function SheetFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const next = Math.min(1, width / 794);
      setScale(next);
      const contentHeight = inner.current?.offsetHeight ?? 1123;
      setHeight(contentHeight * next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (inner.current) observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height }}>
      <div ref={inner} className="sheet-scale" style={{ transform: `scale(${scale})`, width: 794 }}>
        {children}
      </div>
    </div>
  );
}
