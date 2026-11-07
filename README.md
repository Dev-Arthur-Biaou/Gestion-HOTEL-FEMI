# Hotel Fêmi — logiciel interne de séjours, facturation et suivi des paiements

Outil **interne** destiné au personnel de l'Hotel Fêmi (Bénin), pensé pour le poste de la réception.

> **Document interne de préparation et de suivi — ne vaut pas facture normalisée.**
> Le logiciel ne génère **aucun** code MECeF, NIM, QR code fiscal, signature électronique ni
> identifiant officiel. Si une facture normalisée doit être délivrée au client, elle doit être émise
> avec la solution officielle ou autorisée applicable (DGI Bénin). Aucune intégration fiscale
> n'existe dans cette version ; elle pourra être étudiée ultérieurement.

---

## 1. Choix technique (et pourquoi)

Le projet existant fournissait déjà **Next.js 16 (App Router) + React 19 + Tailwind CSS 4 +
Drizzle ORM + PostgreSQL**. Cette stack a été conservée : elle se lance en deux commandes sur
l'ordinateur de l'hôtel, ne dépend d'aucun service en ligne et garde les données sur place.

- **PostgreSQL local** : les données survivent à la fermeture du navigateur et au redémarrage du PC.
- **Initialisation automatique** : au premier accès, le logiciel crée ses tables s'il ne les trouve
  pas, crée le compte réception et charge un jeu de démonstration marqué « démo ».
- **PDF produit sur le poste** (`jspdf` + `jspdf-autotable`) : aucun service externe, aucun envoi
  automatique par e-mail ou WhatsApp.
- **Authentification simple** : un compte, mot de passe haché (scrypt), session de 7 jours en base
  via un cookie `httpOnly`. Adapté à un poste unique, sans complexité inutile.

## 2. Démarrer sur l'ordinateur de l'hôtel

Prérequis : **Node.js 20 ou plus** et **PostgreSQL 14 ou plus** installés sur le poste.

```bash
# 1. Dépendances
npm install

# 2. Connexion à la base locale (fichier .env)
#    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
#    Créez la base si besoin :  createdb app_db

# 3. Build puis démarrage
npm run build
npm start
```

Ouvrir ensuite **http://localhost:3000** dans le navigateur du poste.
Pour un usage quotidien, lancez `npm start` au démarrage de l'ordinateur.

Variante développement : `npm run dev`.
Les tables peuvent aussi être appliquées explicitement avec `npx drizzle-kit push`
(le démarrage automatique s'en charge sinon).

**Connexion de démonstration** : `reception@hotelfemi.bj` / `femi2026`
→ à changer immédiatement dans **Paramètres → Sécurité du poste**.

Le logiciel est prévu pour un usage local : ne l'exposez pas sur Internet sans protection
supplémentaire (VPN, reverse proxy authentifié…).

## 3. Utilisation quotidienne

### Créer un séjour
1. Menu **Nouveau séjour**.
2. Client : réutiliser une fiche (recherche par nom ou téléphone) ou **Nouveau client**
   (le nom seul est obligatoire).
3. Séjour : chambre/type, date **et** heure d'arrivée et de départ, prix par nuit, nombre de
   chambres et de clients. **Les nuits sont calculées automatiquement** ; un départ antérieur ou
   égal à l'arrivée est refusé.
4. Services supplémentaires : une ligne par prestation (catégorie, description, quantité, prix
   unitaire) — le montant se calcule seul.
5. Remise, frais, taxe éventuelle (**aucune taxe par défaut**).
6. Le récapitulatif à droite se met à jour en direct. Enregistrer **en brouillon** ou
   **enregistrer et préparer**. Un identifiant interne `HF-AAAA-0000` est attribué ; il n'est
   **jamais réutilisé**, même après suppression d'un brouillon.

### Ajouter un paiement
- Depuis le dossier du séjour, le tableau de bord, la liste des séjours ou l'écran **Paiements** →
  bouton **Enregistrer un paiement**.
- Date, montant, moyen (liste modifiable), référence et note facultatives.
- Boutons rapides : *Solder*, *Moitié*, *Total du séjour*.
- Un montant supérieur au solde déclenche une **confirmation explicite** et devient un
  **trop-perçu** (montant remboursable). Un **remboursement** peut être saisi.
- Statuts automatiques : brouillon, préparé, partiellement payé, payé en totalité, annulé.
- Suppression d'un paiement : possible, avec **Rétablir** immédiat et trace dans l'historique.

### Générer le PDF
1. Ouvrir le dossier du séjour → **Aperçu du document** (A4, à droite) ou **Aperçu plein écran**.
2. **Télécharger le PDF** → fichier `Hotel-Femi-Sejour-HF-2026-0001-Nom-Client.pdf`,
   ou **Imprimer** (mise en page A4 dédiée).
3. Le document porte le statut, le détail des nuits et services, les paiements, le solde, le pied de
   page et la mention interne obligatoire. Aucun envoi automatique : le fichier est partagé
   manuellement par le personnel.

### Annuler un document
Bouton **Annuler le document** → motif obligatoire. Le document reste consultable, marqué
« annulé », avec son historique. Il peut être réactivé (le numéro est conservé).

## 4. Données, sauvegarde et exports

- **Où ?** Dans la base PostgreSQL locale désignée par `DATABASE_URL` (tables `clients`, `stays`,
  `stay_services`, `payments`, `stay_events`, `settings`, `users`, `sessions`, `counters`).
- **Sauvegarde** : Paramètres → *Sauvegarde et données* → **Télécharger la sauvegarde**
  (fichier `Hotel-Femi-Sauvegarde-AAAA-MM-JJ.json`, à copier sur une clé USB).
- **Restauration** : choisir le fichier JSON, vérifier le résumé, confirmer. Le fichier est validé
  avant écriture ; en cas d'échec, les données actuelles ne sont pas modifiées.
- **Exports tableur** : séjours, paiements, clients au format **CSV** (séparateur `;`, UTF-8 avec
  BOM, ouvrable dans Excel/LibreOffice).
- **Sauvegarde « à froid »** : `pg_dump app_db > femi.sql` fonctionne également.
- **Données de démonstration** : régénérables ou supprimables en un clic ; les saisies réelles ne
  sont jamais touchées.

## 5. Informations de l'hôtel restant à renseigner

Aucune information n'a été inventée. Sont **volontairement vides** et signalés « manquant » :

| Champ | Où le saisir |
| --- | --- |
| Adresse de l'hôtel | Paramètres → Identité |
| Téléphone | Paramètres → Identité |
| Adresse e-mail | Paramètres → Identité |
| Logo (facultatif) | Paramètres → Identité (PNG/JPG, 600 Ko max) |
| Texte de pied de page | Paramètres → Document et mentions |
| Mentions commerciales | Paramètres → Document et mentions |
| Coordonnées de paiement / Mobile Money / banque | Paramètres → Coordonnées de paiement |
| Tarif par nuit par défaut (facultatif) | Paramètres → Document et mentions |
| Taxe éventuelle (après vérification comptable) | Paramètres → Frais et taxe |

Le nom affiché est **Hotel Fêmi**, la devise **FCFA (XOF)**, le préfixe de numérotation **HF** —
tous modifiables. Aucun IFU, régime fiscal ou numéro officiel n'est prérempli.

## 6. Périmètre

**Fonctionnel et vérifié** : connexion/déconnexion, tableau de bord (arrivées, départs, séjours en
cours, encaissements, soldes, graphique 14 jours, répartition des moyens de paiement), création et
modification de séjours, calcul automatique des nuits et des montants, services et frais
modifiables, remise, taxe optionnelle, paiements multiples + remboursements + trop-perçu,
statuts et annulation tracée, recherche et filtres (nom, téléphone, identifiant, dates, statut,
solde), tri, vues enregistrées, sélection multiple et actions groupées, tiroir de détail,
annotations d'historique, PDF A4 (aperçu, téléchargement, impression), clients (CRUD + historique),
paramètres complets, sauvegarde/restauration JSON, exports CSV, changement de mot de passe,
gestion des erreurs et messages en français, états vides et états de chargement.

**Non inclus (volontairement)** : réservation en ligne, gestion des disponibilités, gestion du
personnel, comptabilité complète, déclarations fiscales, paiement en ligne, envoi automatique
d'e-mails/WhatsApp, intégration fiscale non approuvée, statistiques avancées.

**Pistes futures** : connexion à une solution de facturation normalisée approuvée par la DGI,
multi-postes en réseau local avec comptes par employé, planning des chambres, relances manuelles
des soldes, sauvegarde automatique planifiée.

## 7. Principaux fichiers

```
src/db/schema.ts                     Tables Drizzle (clients, séjours, services, paiements…)
src/lib/bootstrap.ts                 Création des tables + compte + démo au premier lancement
src/lib/seed.ts                      Jeu de démonstration et numérotation interne
src/lib/stays.ts                     Règles métier : calculs, filtres, tableau de bord
src/lib/money.ts, dates.ts           Calculs FCFA et dates (sans décalage horaire)
src/lib/auth.ts, api.ts              Sessions, hachage, garde d'authentification, erreurs
src/lib/pdf.ts                       Génération du PDF A4
src/app/api/**                       API REST (auth, séjours, clients, paiements, paramètres,
                                     sauvegarde, restauration, exports, démo)
src/app/connexion/                   Écran de connexion
src/app/(app)/tableau-de-bord/       Tableau de bord
src/app/(app)/sejours/               Liste, création, dossier détaillé, modification
src/app/(app)/clients/               Fiches clients et historique
src/app/(app)/paiements/             Journal des encaissements
src/app/(app)/parametres/            Réglages, sécurité, sauvegarde
src/components/**                    Interface (coque, formulaires, document A4, graphiques…)
scripts/check-pdf.ts                 Recette du générateur PDF (serveur démarré requis)
```

## 8. Vérifications effectuées dans l'environnement de développement

- `npx next typegen`, `tsc --noEmit`, `npm run build`, `npx eslint .` : **sans erreur**.
- Serveur de production démarré, `/api/health` OK, toutes les pages rendues en HTTP 200.
- Parcours testés via l'API réelle : connexion, création de séjour (3 nuits × 25 000 + 9 000 de
  services − 5 000 de remise + 2 000 de frais = **81 000 FCFA**), paiement partiel, refus puis
  confirmation d'un trop-perçu, remboursement, annulation avec motif, réactivation, suppression de
  paiement avec trace, CRUD client (suppression refusée si séjours liés), exports CSV, sauvegarde
  puis restauration complète, refus d'un fichier de sauvegarde invalide, accès refusé sans session
  (401), numérotation non réutilisée après restauration.
- Génération PDF exécutée réellement (4 documents : payé, annulé, brouillon, et variante avec logo,
  taxe, frais et coordonnées de paiement) : fichiers `%PDF` valides et nommés correctement.