"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconPlus,
  IconRefresh,
  IconSave,
  IconShield,
  IconTrash,
  IconUpload,
  IconX,
} from "@/components/icons";
import { useSettings } from "@/components/settings-context";
import { useToast } from "@/components/toast";
import { Button, Field, Notice, SectionTitle, Tag, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { num, type Fee } from "@/lib/money";
import type { SettingsDTO } from "@/lib/types";

const SECTIONS = [
  { id: "identite", label: "Identité de l'hôtel" },
  { id: "document", label: "Document et mentions" },
  { id: "tarifs", label: "Tarifs, frais et taxe" },
  { id: "listes", label: "Listes modifiables" },
  { id: "paiement", label: "Coordonnées de paiement" },
  { id: "securite", label: "Sécurité" },
  { id: "donnees", label: "Sauvegarde et données" },
];

function ListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="chip border border-line-strong bg-surface text-ink-soft">
            {value}
            <button
              type="button"
              className="text-muted transition hover:text-danger"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Retirer ${value}`}
            >
              <IconX width={11} height={11} />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="text-[0.8rem] text-muted">Liste vide.</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="field"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!values.includes(draft.trim())) onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<IconPlus width={13} height={13} />}
          onClick={() => {
            if (draft.trim() && !values.includes(draft.trim())) onChange([...values, draft.trim()]);
            setDraft("");
          }}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const { push } = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<SettingsDTO>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const [restoreData, setRestoreData] = useState<Record<string, unknown> | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [demoAction, setDemoAction] = useState<"reset" | "clear" | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const missing = [
    { key: "address", label: "Adresse" },
    { key: "phone", label: "Téléphone" },
    { key: "email", label: "E-mail" },
    { key: "logo", label: "Logo" },
    { key: "footerText", label: "Pied de page" },
  ].filter((item) => !String(draft[item.key as keyof SettingsDTO] ?? ""));

  function set<K extends keyof SettingsDTO>(key: K, value: SettingsDTO[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ settings: SettingsDTO }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setSettings(result.settings);
      setDraft(result.settings);
      push({ tone: "success", title: "Paramètres enregistrés", message: "Les prochains documents utiliseront ces informations." });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Logo invalide : choisissez une image PNG ou JPG.");
      return;
    }
    if (file.size > 600_000) {
      setError("Logo trop lourd : 600 Ko maximum.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result ?? ""));
    reader.onerror = () => setError("Lecture du fichier impossible. Réessayez avec une autre image.");
    reader.readAsDataURL(file);
  }

  async function changePassword() {
    setPwdError(null);
    if (passwords.next.length < 6) {
      setPwdError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPwdError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setPwdBusy(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ current: passwords.current, next: passwords.next }),
      });
      setPasswords({ current: "", next: "", confirm: "" });
      push({ tone: "success", title: "Mot de passe modifié", message: "Utilisez-le à la prochaine connexion." });
    } catch (err) {
      setPwdError(errorMessage(err));
    } finally {
      setPwdBusy(false);
    }
  }

  async function pickBackup(file: File | undefined) {
    if (!file) return;
    setRestoreError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed.format !== "hotel-femi-sauvegarde") {
        setRestoreError("Ce fichier n'est pas une sauvegarde Hotel Fêmi. Aucune donnée n'a été modifiée.");
        return;
      }
      setRestoreData(parsed);
    } catch {
      setRestoreError("Fichier illisible : la sauvegarde est peut-être incomplète. Vos données sont intactes.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmRestore() {
    if (!restoreData) return;
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const result = await api<{ restored: { clients: number; stays: number; payments: number } }>(
        "/api/backup/restore",
        { method: "POST", body: JSON.stringify({ ...restoreData, confirm: true }) },
      );
      const fresh = await api<{ settings: SettingsDTO }>("/api/settings");
      setSettings(fresh.settings);
      setDraft(fresh.settings);
      setRestoreData(null);
      push({
        tone: "success",
        title: "Sauvegarde restaurée",
        message: `${result.restored.stays} séjour(s), ${result.restored.clients} client(s), ${result.restored.payments} paiement(s).`,
      });
      router.refresh();
    } catch (err) {
      setRestoreError(errorMessage(err));
    } finally {
      setRestoreBusy(false);
    }
  }

  async function runDemo() {
    if (!demoAction) return;
    setDemoBusy(true);
    try {
      const result = await api<{ created: number }>("/api/admin/demo", {
        method: "POST",
        body: JSON.stringify({ action: demoAction }),
      });
      push({
        tone: "success",
        title: demoAction === "reset" ? "Données de démonstration régénérées" : "Données de démonstration supprimées",
        message: demoAction === "reset" ? `${result.created} séjour(s) d'exemple créés.` : "Vos saisies réelles sont conservées.",
      });
      setDemoAction(null);
      router.refresh();
    } catch (err) {
      push({ tone: "error", title: "Opération impossible", message: errorMessage(err) });
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <nav className="panel anim-rise flex flex-wrap gap-1.5 px-3 py-2.5">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="btn btn-ghost btn-sm">
            {section.label}
          </a>
        ))}
      </nav>

      {missing.length > 0 && (
        <Notice tone="warning" title="Informations de l'hôtel à compléter">
          {missing.map((m) => m.label).join(" · ")}. Ces champs apparaîtront comme « non renseigné »
          sur les documents tant qu'ils ne sont pas saisis. Aucune information n'est inventée par le
          logiciel.
        </Notice>
      )}

      <section id="identite" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Identité de l'hôtel" subtitle="Affichée en en-tête des documents" icon={<IconShield width={17} height={17} />} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nom affiché" required>
            <input className="field" value={draft.hotelName} onChange={(e) => set("hotelName", e.target.value)} />
          </Field>
          <Field label="Téléphone" hint={draft.phone ? undefined : "Non renseigné"}>
            <input className={cn("field", !draft.phone && "border-dashed")} value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="À compléter" />
          </Field>
          <Field label="Adresse" className="sm:col-span-2" hint={draft.address ? undefined : "Non renseignée"}>
            <input className={cn("field", !draft.address && "border-dashed")} value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="Quartier, ville, pays — à compléter" />
          </Field>
          <Field label="E-mail (si disponible)">
            <input className="field" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@…" />
          </Field>
          <Field label="Devise">
            <input className="field" value="FCFA (XOF)" disabled />
          </Field>

          <div className="sm:col-span-2">
            <span className="label">Logo (facultatif)</span>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-overlay p-4">
              {draft.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logo} alt="Logo de l'hôtel" className="h-16 w-16 rounded-xl border border-line object-contain" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-line bg-surface text-[0.7rem] text-muted">
                  aucun
                </div>
              )}
              <div className="flex-1">
                <p className="text-[0.82rem] text-ink-soft">
                  PNG ou JPG, 600 Ko maximum. Le logo n'est pas obligatoire : le nom de l'hôtel
                  suffit sur le document.
                </p>
                <div className="mt-2 flex gap-2">
                  <label className="btn btn-ghost btn-sm cursor-pointer">
                    <IconUpload width={13} height={13} />
                    Choisir une image
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                  </label>
                  {draft.logo && (
                    <Button variant="ghost" size="sm" icon={<IconTrash width={13} height={13} />} onClick={() => set("logo", "")}>
                      Retirer
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="document" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Document et mentions" subtitle="Numérotation interne et textes du document" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Préfixe de numérotation interne" hint={`Prochain document : ${draft.docPrefix}-AAAA-0001. Les numéros déjà attribués ne sont jamais réutilisés.`}>
            <input className="field" value={draft.docPrefix} onChange={(e) => set("docPrefix", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Tarif par nuit par défaut (FCFA)" hint="0 = aucun tarif prérempli.">
            <input type="number" min={0} step={500} className="field tabular" value={draft.defaultNightlyRate} onChange={(e) => set("defaultNightlyRate", num(e.target.value))} />
          </Field>
          <Field label="Texte de pied de page" className="sm:col-span-2" hint="Ex. conditions de départ, remerciements.">
            <textarea className="field min-h-[70px]" value={draft.footerText} onChange={(e) => set("footerText", e.target.value)} placeholder="À compléter" />
          </Field>
          <Field label="Mentions commerciales" className="sm:col-span-2" hint="Affichées en bas du document, si vous le souhaitez.">
            <textarea className="field min-h-[70px]" value={draft.commercialNotes} onChange={(e) => set("commercialNotes", e.target.value)} />
          </Field>
        </div>
        <div className="px-5 pb-5">
          <Notice tone="info" title="Facture normalisée">
            Ce logiciel produit uniquement un document interne. Aucun code MECeF, NIM, QR code
            fiscal ou signature officielle n'est généré. Une intégration avec une solution approuvée
            par la DGI pourra être étudiée ultérieurement : elle n'existe pas dans cette version.
          </Notice>
        </div>
      </section>

      <section id="tarifs" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Frais et taxe" subtitle="Aucun taux n'est appliqué par défaut" />
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Frais ajoutés automatiquement à un nouveau séjour</span>
              <Button variant="ghost" size="sm" icon={<IconPlus width={13} height={13} />} onClick={() => set("extraFees", [...draft.extraFees, { label: "", mode: "fixe", value: 0 }])}>
                Ajouter un frais
              </Button>
            </div>
            {draft.extraFees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong bg-overlay px-4 py-3 text-[0.82rem] text-muted">
                Aucun frais par défaut. Chaque frais reste modifiable séjour par séjour.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.extraFees.map((fee, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_10rem_8rem_2rem] sm:items-center">
                    <input
                      className="field"
                      value={fee.label}
                      placeholder="Libellé (ex. frais de dossier)"
                      onChange={(e) => set("extraFees", draft.extraFees.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))}
                    />
                    <select
                      className="field"
                      value={fee.mode}
                      onChange={(e) => set("extraFees", draft.extraFees.map((f, i) => (i === index ? { ...f, mode: e.target.value as Fee["mode"] } : f)))}
                    >
                      <option value="fixe">Montant fixe</option>
                      <option value="pourcentage">Pourcentage</option>
                    </select>
                    <input
                      type="number"
                      className="field tabular"
                      value={fee.value}
                      onChange={(e) => set("extraFees", draft.extraFees.map((f, i) => (i === index ? { ...f, value: num(e.target.value) } : f)))}
                    />
                    <button
                      type="button"
                      className="justify-self-end rounded-lg p-2 text-muted hover:bg-[rgba(191,58,43,0.1)] hover:text-danger"
                      onClick={() => set("extraFees", draft.extraFees.filter((_, i) => i !== index))}
                      aria-label="Supprimer le frais"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Libellé de taxe (facultatif)">
              <input className="field" value={draft.taxLabel} onChange={(e) => set("taxLabel", e.target.value)} placeholder="Aucune taxe configurée" />
            </Field>
            <Field label="Taux de taxe (%)">
              <input type="number" min={0} max={100} step="0.1" className="field tabular" value={draft.taxRate} onChange={(e) => set("taxRate", num(e.target.value))} />
            </Field>
          </div>
          <Notice tone="warning" title="À vérifier avant activation">
            Le logiciel ne connaît aucune règle fiscale (TVA, taxe de séjour, retenue…). Ne saisissez
            un taux qu'après vérification auprès de votre comptable ou de l'administration
            compétente.
          </Notice>
        </div>
      </section>

      <section id="listes" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Listes modifiables" subtitle="Adaptez le vocabulaire à votre hôtel" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <span className="label">Catégories de services</span>
            <ListEditor values={draft.serviceCategories} onChange={(v) => set("serviceCategories", v)} placeholder="Ajouter une catégorie" />
            <p className="mt-2 text-[0.75rem] text-muted">
              Ces catégories sont des exemples modifiables : elles ne préjugent pas des services
              réellement proposés par l'hôtel.
            </p>
          </div>
          <div>
            <span className="label">Moyens de paiement</span>
            <ListEditor values={draft.paymentMethods} onChange={(v) => set("paymentMethods", v)} placeholder="Ajouter un moyen de paiement" />
          </div>
        </div>
      </section>

      <section id="paiement" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Coordonnées de paiement" subtitle="Affichées uniquement si vous les saisissez" />
        <div className="grid gap-4 p-5">
          <Field label="Instructions de paiement">
            <textarea className="field min-h-[70px]" value={draft.paymentInfo} onChange={(e) => set("paymentInfo", e.target.value)} placeholder="Ex. règlement à la réception, à l'arrivée…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile Money" hint="Aucun numéro n'est prérempli.">
              <input className="field" value={draft.momoDetails} onChange={(e) => set("momoDetails", e.target.value)} placeholder="Opérateur et numéro à compléter" />
            </Field>
            <Field label="Coordonnées bancaires" hint="À saisir uniquement si l'hôtel souhaite les afficher.">
              <input className="field" value={draft.bankDetails} onChange={(e) => set("bankDetails", e.target.value)} placeholder="Banque, intitulé du compte, IBAN…" />
            </Field>
          </div>
        </div>
      </section>

      <section id="securite" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Sécurité du poste" subtitle="Un compte suffit pour un ordinateur unique" icon={<IconShield width={17} height={17} />} />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Mot de passe actuel">
            <input type="password" className="field" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} autoComplete="current-password" />
          </Field>
          <Field label="Nouveau mot de passe">
            <input type="password" className="field" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="Confirmer">
            <input type="password" className="field" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} autoComplete="new-password" />
          </Field>
          <div className="sm:col-span-3">
            {pwdError && <div className="mb-3"><Notice tone="danger">{pwdError}</Notice></div>}
            <Button variant="primary" loading={pwdBusy} icon={<IconCheck width={15} height={15} />} onClick={changePassword}>
              Changer le mot de passe
            </Button>
            <p className="mt-2 text-[0.76rem] text-muted">
              Session de 7 jours, cookie httpOnly, mot de passe haché (scrypt). Le logiciel est
              prévu pour un poste local : ne l'exposez pas sur Internet sans protection
              supplémentaire.
            </p>
          </div>
        </div>
      </section>

      <section id="donnees" className="panel anim-rise scroll-mt-32 overflow-hidden">
        <SectionTitle title="Sauvegarde et données" subtitle="Vos données restent sur ce poste" />
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-overlay p-4">
            <p className="font-display text-[1.02rem] font-semibold text-ink">Sauvegarder</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">
              Un fichier JSON contient les paramètres, clients, séjours, services, paiements et
              l'historique. Conservez-le sur une clé USB.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/api/backup" className="btn btn-primary btn-sm">
                <IconDownload width={14} height={14} />
                Télécharger la sauvegarde
              </a>
              <a href="/api/export?type=stays" className="btn btn-ghost btn-sm">Séjours (CSV)</a>
              <a href="/api/export?type=payments" className="btn btn-ghost btn-sm">Paiements (CSV)</a>
              <a href="/api/export?type=clients" className="btn btn-ghost btn-sm">Clients (CSV)</a>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-overlay p-4">
            <p className="font-display text-[1.02rem] font-semibold text-ink">Restaurer</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">
              La restauration remplace les données actuelles par celles du fichier. Une confirmation
              vous est demandée et le fichier est vérifié avant toute écriture.
            </p>
            <div className="mt-3">
              <label className="btn btn-ghost btn-sm cursor-pointer">
                <IconUpload width={14} height={14} />
                Choisir un fichier de sauvegarde
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pickBackup(e.target.files?.[0])} />
              </label>
            </div>
            {restoreError && <div className="mt-3"><Notice tone="danger">{restoreError}</Notice></div>}
          </div>

          <div className="rounded-2xl border border-line bg-overlay p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.02rem] font-semibold text-ink">
                  Données de démonstration
                </p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">
                  Le logiciel est livré avec des séjours d'exemple, clairement marqués « démo ».
                  Supprimez-les avant un usage réel : vos propres saisies ne sont jamais touchées.
                </p>
              </div>
              <Tag tone="or">démo</Tag>
              <Button variant="ghost" size="sm" icon={<IconRefresh width={14} height={14} />} onClick={() => setDemoAction("reset")}>
                Régénérer
              </Button>
              <Button variant="danger" size="sm" icon={<IconTrash width={14} height={14} />} onClick={() => setDemoAction("clear")}>
                Supprimer la démo
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-[rgba(255,252,247,0.94)] px-4 py-3 backdrop-blur-md lg:pl-[292px]">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-[0.82rem] text-muted">
            {dirty ? (
              <span className="flex items-center gap-2 font-semibold text-terre">
                <IconAlert width={14} height={14} />
                Modifications non enregistrées
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconCheck width={14} height={14} className="text-success" />
                Paramètres à jour
              </span>
            )}
          </p>
          {error && <span className="text-[0.8rem] font-semibold text-danger">{error}</span>}
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => { setDraft(settings); setError(null); }}>
            Annuler les changements
          </Button>
          <Button variant="primary" loading={saving} disabled={!dirty} icon={<IconSave width={15} height={15} />} onClick={save}>
            Enregistrer les paramètres
          </Button>
        </div>
      </div>

      {restoreData && (
        <div className="no-print fixed inset-0 z-[75] grid place-items-center bg-[rgba(8,34,29,0.55)] p-4 backdrop-blur-[2px]">
          <div className="panel anim-pop w-full max-w-lg p-6">
            <h3 className="font-display text-xl font-semibold text-ink">Confirmer la restauration</h3>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-soft">
              Le fichier contient{" "}
              <strong>{(restoreData.stays as unknown[] | undefined)?.length ?? 0} séjour(s)</strong>,{" "}
              <strong>{(restoreData.clients as unknown[] | undefined)?.length ?? 0} client(s)</strong> et{" "}
              <strong>{(restoreData.payments as unknown[] | undefined)?.length ?? 0} paiement(s)</strong>.
              Les données actuellement enregistrées sur ce poste seront remplacées.
            </p>
            <p className="mt-2 text-[0.8rem] text-muted">
              Conseil : téléchargez d'abord une sauvegarde de l'état actuel.
            </p>
            {restoreError && <div className="mt-3"><Notice tone="danger">{restoreError}</Notice></div>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRestoreData(null)} disabled={restoreBusy}>
                Annuler
              </Button>
              <Button variant="accent" loading={restoreBusy} icon={<IconUpload width={15} height={15} />} onClick={confirmRestore}>
                Restaurer ces données
              </Button>
            </div>
          </div>
        </div>
      )}

      {demoAction && (
        <div className="no-print fixed inset-0 z-[75] grid place-items-center bg-[rgba(8,34,29,0.55)] p-4 backdrop-blur-[2px]">
          <div className="panel anim-pop w-full max-w-md p-6">
            <h3 className="font-display text-lg font-semibold text-ink">
              {demoAction === "reset" ? "Régénérer la démonstration" : "Supprimer la démonstration"}
            </h3>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-soft">
              {demoAction === "reset"
                ? "Les séjours de démonstration actuels seront remplacés par un nouveau jeu d'exemple. Les numéros internes déjà attribués ne seront pas réutilisés."
                : "Seuls les clients, séjours et paiements marqués « démo » seront supprimés. Vos saisies réelles sont conservées."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDemoAction(null)} disabled={demoBusy}>
                Annuler
              </Button>
              <Button variant={demoAction === "clear" ? "danger" : "primary"} loading={demoBusy} onClick={runDemo}>
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
