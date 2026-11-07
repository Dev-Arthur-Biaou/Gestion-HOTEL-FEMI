"use client";

import { useState } from "react";
import { frDayMonth } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";

const PALETTE = ["#126552", "#bf5127", "#dda118", "#2f6fed", "#2b9a7c", "#8a5cd6", "#c07708"];

export function CashflowChart({ data }: { data: { date: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.amount));
  const width = 560;
  const height = 168;
  const gap = 8;
  const barWidth = (width - gap * (data.length - 1)) / Math.max(1, data.length);

  return (
    <div className="px-5 pb-5 pt-3">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height + 26}`} className="w-full" role="img" aria-label="Encaissements des 14 derniers jours">
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b9a7c" />
              <stop offset="100%" stopColor="#126552" />
            </linearGradient>
            <linearGradient id="barHot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0743f" />
              <stop offset="100%" stopColor="#bf5127" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={height - height * ratio}
              y2={height - height * ratio}
              stroke="#e2d8c6"
              strokeDasharray="3 5"
            />
          ))}
          {data.map((d, i) => {
            const h = Math.max(d.amount > 0 ? 4 : 2, (d.amount / max) * height);
            const x = i * (barWidth + gap);
            const active = hover === i;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect x={x} y={0} width={barWidth} height={height} fill="transparent" />
                <rect
                  x={x}
                  y={height - h}
                  width={barWidth}
                  height={h}
                  rx={5}
                  fill={active ? "url(#barHot)" : "url(#barFill)"}
                  opacity={d.amount === 0 ? 0.25 : 1}
                />
                {i % 2 === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={height + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#786d5c"
                  >
                    {frDayMonth(d.date).replace(".", "")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-[0.72rem] shadow-[var(--shadow-panel)]"
            style={{
              left: `${Math.min(82, (hover / Math.max(1, data.length - 1)) * 100)}%`,
            }}
          >
            <p className="font-bold text-ink">{formatMoney(data[hover].amount)}</p>
            <p className="text-muted">{frDayMonth(data[hover].date)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function MethodsChart({ data }: { data: { method: string; amount: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  if (total === 0) {
    return (
      <p className="px-5 pb-6 pt-2 text-[0.82rem] text-muted">
        Aucun encaissement enregistré ce mois-ci.
      </p>
    );
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    share: d.amount / total,
    offset: data.slice(0, i).reduce((sum, previous) => sum + previous.amount / total, 0),
  }));

  return (
    <div className="flex flex-wrap items-center gap-5 px-5 pb-5 pt-2">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label="Répartition des moyens de paiement">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e9e0d0" strokeWidth="18" />
        {segments.map((segment) => {
          const dash = segment.share * circumference;
          return (
            <circle
              key={segment.method}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-segment.offset * circumference}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="12" fill="#786d5c">
          Ce mois
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1d1a15">
          {formatNumber(total)}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.method} className="flex items-center gap-2.5 text-[0.8rem]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink-soft">{d.method}</span>
            <span className="tabular font-bold text-ink">{formatNumber(d.amount)}</span>
            <span className="tabular w-10 text-right text-muted">
              {Math.round((d.amount / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values, color = PALETTE[1] }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
