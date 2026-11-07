"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconDashboard,
  IconFolder,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/icons";
import { StatusBadge, Tag, cn } from "@/components/ui";
import { api } from "@/lib/client";
import { frDate, todayISO } from "@/lib/dates";
import type { SettingsDTO, StayDTO } from "@/lib/types";

const NAV = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: IconDashboard, hint: "Vue du jour" },
  { href: "/sejours/nouveau", label: "Nouveau séjour", icon: IconPlus, hint: "Préparer un document" },
  { href: "/clients", label: "Clients", icon: IconUsers, hint: "Fiches et historiques" },
  { href: "/sejours", label: "Séjours & documents", icon: IconFolder, hint: "Recherche et suivi" },
  { href: "/paiements", label: "Paiements", icon: IconWallet, hint: "Encaissements" },
  { href: "/parametres", label: "Paramètres", icon: IconSettings, hint: "Hôtel et sauvegarde" },
];

const TITLES: Record<string, string> = {
  "/tableau-de-bord": "Tableau de bord",
  "/sejours/nouveau": "Nouveau séjour",
  "/clients": "Clients",
  "/sejours": "Séjours & documents",
  "/paiements": "Paiements",
  "/parametres": "Paramètres de l'hôtel",
};

export function AppShell({
  user,
  settings,
  children,
}: {
  user: { id: number; name: string; email: string; role: string };
  settings: SettingsDTO;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StayDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [openResults, setOpenResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setOpenResults(false);
  }, [pathname]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ stays: StayDTO[] }>(`/api/stays?q=${encodeURIComponent(query.trim())}`);
        setResults(data.stays.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpenResults(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/connexion");
    router.refresh();
  }, [router]);

  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/sejours/") ? "Dossier de séjour" : "Hotel Fêmi");

  const isActive = (href: string) => {
    if (href === "/sejours") {
      return (
        pathname === "/sejours" ||
        (pathname.startsWith("/sejours/") && pathname !== "/sejours/nouveau")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen lg:flex">
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-[rgba(8,34,29,0.55)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col overflow-y-auto bg-nuit text-[#e8f2ec] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          backgroundImage:
            "radial-gradient(520px 280px at 10% 0%, rgba(43,154,124,0.35), transparent 65%), radial-gradient(420px 320px at 100% 100%, rgba(191,81,39,0.28), transparent 60%)",
        }}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-or to-terre text-nuit shadow-[0_10px_24px_-10px_rgba(221,161,24,0.9)]">
            <span className="font-display text-xl font-bold">F</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.15rem] font-semibold leading-tight text-[#fdf6e8]">
              {settings.hotelName}
            </p>
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[#8fbfae]">
              Régie interne · Bénin
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-[#8fbfae] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <IconX />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "nav-item anim-rise flex items-center gap-3 rounded-xl px-3 py-2.5",
                  active
                    ? "bg-[rgba(253,246,232,0.12)] text-[#fdf6e8]"
                    : "text-[#a9c9bd] hover:bg-[rgba(253,246,232,0.07)] hover:text-[#fdf6e8]",
                )}
                style={{ ["--d" as string]: `${index * 45}ms` }}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border transition",
                    active
                      ? "border-or/60 bg-[rgba(221,161,24,0.18)] text-or-soft"
                      : "border-[rgba(253,246,232,0.12)] text-[#7fb9a5]",
                  )}
                >
                  <Icon width={16} height={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.86rem] font-semibold leading-tight">{item.label}</span>
                  <span className="block text-[0.68rem] text-[#7fa394]">{item.hint}</span>
                </span>
                {active && <span className="h-6 w-1 rounded-full bg-or" />}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-3 mt-4 rounded-2xl border border-[rgba(253,246,232,0.12)] bg-[rgba(8,34,29,0.5)] p-3.5">
          <div className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#8fbfae]">
            <span className="pulse-ring h-2 w-2 rounded-full bg-palm-400" />
            Données locales
          </div>
          <p className="mt-1.5 text-[0.72rem] leading-snug text-[#9dbcae]">
            PostgreSQL sur ce poste. Pensez à exporter une sauvegarde depuis les paramètres.
          </p>
        </div>

        <div className="border-t border-[rgba(253,246,232,0.12)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[rgba(253,246,232,0.14)] text-[0.8rem] font-bold text-or-soft">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.82rem] font-semibold text-[#fdf6e8]">{user.name}</p>
              <p className="truncate text-[0.68rem] text-[#7fa394]">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="rounded-lg border border-[rgba(253,246,232,0.14)] p-1.5 text-[#a9c9bd] transition hover:border-terre-400 hover:text-terre-400"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-[rgba(255,252,247,0.88)] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="rounded-xl border border-line bg-surface p-2 text-ink-soft lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[1.15rem] font-semibold text-ink">{title}</h1>
              <p className="text-[0.72rem] text-muted">{frDate(todayISO(), "long")}</p>
            </div>

            <div ref={searchRef} className="relative order-last w-full sm:order-none sm:w-72">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch width={15} height={15} />
              </span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpenResults(true);
                }}
                onFocus={() => setOpenResults(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    router.push(`/sejours?q=${encodeURIComponent(query.trim())}`);
                    setOpenResults(false);
                  }
                  if (e.key === "Escape") setOpenResults(false);
                }}
                placeholder="Client, téléphone, n° de document…"
                className="field pl-9"
                aria-label="Recherche rapide"
              />
              {openResults && query.trim().length >= 2 && (
                <div className="anim-pop absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
                  {searching && <p className="px-4 py-3 text-[0.8rem] text-muted">Recherche…</p>}
                  {!searching && results.length === 0 && (
                    <p className="px-4 py-3 text-[0.8rem] text-muted">
                      Aucun dossier ne correspond à « {query} ».
                    </p>
                  )}
                  {!searching &&
                    results.map((stay) => (
                      <Link
                        key={stay.id}
                        href={`/sejours/${stay.id}`}
                        className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-overlay"
                        onClick={() => setOpenResults(false)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.85rem] font-semibold text-ink">
                            {stay.client.name}
                          </p>
                          <p className="truncate text-[0.72rem] text-muted">
                            {stay.number} · {stay.roomLabel || "Chambre non précisée"}
                          </p>
                        </div>
                        <StatusBadge status={stay.status} />
                      </Link>
                    ))}
                </div>
              )}
            </div>

            <Link href="/sejours/nouveau" className="btn btn-accent">
              <IconPlus width={16} height={16} />
              Nouveau séjour
            </Link>
          </div>
          <div className="flex items-center gap-2 border-t border-line bg-[rgba(221,161,24,0.1)] px-4 py-1.5 text-[0.7rem] font-semibold text-[#8a6206] sm:px-6">
            <IconShield width={13} height={13} />
            Outil interne de préparation et de suivi — ne vaut pas facture normalisée (DGI / SyGMEF).
            <Tag tone="or" className="ml-auto hidden sm:inline-flex">
              Version 1 · poste local
            </Tag>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>

        <footer className="no-print border-t border-line px-4 py-4 text-[0.72rem] text-muted sm:px-6">
          {settings.hotelName} · Numérotation interne {settings.docPrefix}-AAAA-0000 · Données
          enregistrées localement, non publiées sur Internet.
        </footer>
      </div>
    </div>
  );
}
