"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconArrowRight, IconEye, IconMoon, IconShield, IconSpark, IconWallet } from "@/components/icons";
import { Button, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";

export function LoginForm({ demo }: { demo: { email: string; password: string } }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("expire") ? "Votre session a expiré. Merci de vous reconnecter." : null,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Merci de saisir votre identifiant et votre mot de passe.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      router.replace("/tableau-de-bord");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section
        className="relative hidden overflow-hidden bg-nuit px-12 py-14 text-[#e9f3ed] lg:flex lg:flex-col"
        style={{
          backgroundImage:
            "radial-gradient(700px 420px at 12% 8%, rgba(43,154,124,0.42), transparent 62%), radial-gradient(620px 460px at 92% 92%, rgba(191,81,39,0.4), transparent 60%), radial-gradient(520px 320px at 70% 20%, rgba(221,161,24,0.22), transparent 65%)",
        }}
      >
        <div className="mudcloth pointer-events-none absolute inset-x-0 bottom-0 h-52 opacity-40" />
        <div className="anim-float pointer-events-none absolute right-16 top-24 h-28 w-28 rounded-[2rem] border border-[rgba(221,161,24,0.4)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-or to-terre text-nuit">
            <span className="font-display text-2xl font-bold">F</span>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-[#fdf6e8]">Hotel Fêmi</p>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#8fbfae]">Bénin · Régie interne</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-xl">
          <p className="anim-rise text-[0.72rem] font-bold uppercase tracking-[0.24em] text-or-soft">
            Séjours · Calculs · Paiements
          </p>
          <h1 className="anim-rise mt-4 font-display text-[3.1rem] font-semibold leading-[1.03] text-[#fdf6e8]" style={{ ["--d" as string]: "80ms" }}>
            La réception garde
            <br />
            le fil, sans paperasse.
          </h1>
          <p className="anim-rise mt-5 max-w-md text-[0.95rem] leading-relaxed text-[#b6d3c7]" style={{ ["--d" as string]: "160ms" }}>
            Enregistrez un séjour, les nuits se calculent seules, les services s'ajoutent en une
            ligne, et le document A4 sort propre — prêt à imprimer ou à remettre au client.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <IconMoon width={16} height={16} />, title: "Nuits automatiques", text: "Arrivée → départ, sans erreur de calcul." },
              { icon: <IconWallet width={16} height={16} />, title: "Solde en direct", text: "Acomptes, reste dû, trop-perçu." },
              { icon: <IconSpark width={16} height={16} />, title: "PDF A4 net", text: "Aperçu avant impression ou téléchargement." },
            ].map((card, i) => (
              <div
                key={card.title}
                className="anim-rise rounded-2xl border border-[rgba(253,246,232,0.14)] bg-[rgba(8,34,29,0.42)] p-4"
                style={{ ["--d" as string]: `${240 + i * 90}ms` }}
              >
                <span className="text-or-soft">{card.icon}</span>
                <p className="mt-2 text-[0.85rem] font-bold text-[#fdf6e8]">{card.title}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-[#9dbcae]">{card.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-10 flex items-center gap-2 text-[0.72rem] text-[#8fbfae]">
          <IconShield width={14} height={14} />
          Les données restent sur cet ordinateur. Aucune publication en ligne.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="anim-rise mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-or to-terre text-nuit">
              <span className="font-display text-xl font-bold">F</span>
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Hotel Fêmi</p>
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">Régie interne</p>
            </div>
          </div>

          <div className="panel anim-rise p-7" style={{ ["--d" as string]: "60ms" }}>
            <h2 className="font-display text-2xl font-semibold text-ink">Connexion du personnel</h2>
            <p className="mt-1 text-sm text-muted">
              Accès réservé à l'équipe de l'hôtel. Un seul compte suffit pour un poste unique.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="label">Identifiant (e-mail)</span>
                <input
                  className="field"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reception@hotelfemi.bj"
                />
              </label>

              <label className="block">
                <span className="label">Mot de passe</span>
                <span className="relative block">
                  <input
                    className="field pr-11"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-palm"
                  >
                    <IconEye width={16} height={16} />
                  </button>
                </span>
              </label>

              {error && <Notice tone="danger">{error}</Notice>}

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full"
                icon={<IconArrowRight width={16} height={16} />}
              >
                {loading ? "Ouverture de la session…" : "Ouvrir ma session"}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-overlay p-4">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">
                Poste de démonstration
              </p>
              <p className="mt-1.5 text-[0.82rem] leading-snug text-ink-soft">
                Identifiant : <strong>{demo.email}</strong>
                <br />
                Mot de passe : <strong>{demo.password}</strong>
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3"
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(demo.password);
                  setError(null);
                }}
              >
                Remplir automatiquement
              </button>
              <p className="mt-2.5 text-[0.72rem] leading-snug text-muted">
                Changez ce mot de passe dans Paramètres → Sécurité avant un usage réel.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[0.72rem] leading-relaxed text-muted">
            Document interne de préparation et de suivi — ne vaut pas facture normalisée.
            <br />
            Toute facture normalisée doit être émise avec la solution officielle applicable.
          </p>
        </div>
      </section>
    </div>
  );
}
