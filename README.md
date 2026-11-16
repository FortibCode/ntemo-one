# NTEMO ONE — Plateforme intégrée RH, présences, badges et documents

Plateforme interne de **NTEMO Consulting** : gestion du personnel, pointage par QR code dynamique, badges, congés, projets et feuilles de temps, génération de documents officiels et assistant IA de rédaction. Elle répond au cahier des charges v1.0 du 29 octobre 2026.

| Composant | Technologie | Dossier |
|---|---|---|
| API REST (`/api/v1`, 78 routes) | Laravel 12, PHP 8.3+, PostgreSQL 16+, Sanctum | `backend/` |
| Portail web (Direction, RH, responsables) | Next.js 16, React 19, TypeScript, Tailwind CSS | `frontend/` |
| Application mobile (collaborateurs) | Flutter 3.47+ (Android et iOS) | `mobile/` |

> Le cahier des charges recommandait NestJS pour l'API ; le projet a été réalisé avec Laravel, qui couvre les mêmes besoins (REST, RBAC, génération documentaire).

---

## Modules

| Module (§ cahier des charges) | Ce qui est livré |
|---|---|
| **Présences par QR code** (§3.1) | Borne web plein écran affichant un QR signé (HMAC-SHA256) renouvelé toutes les 15 s, à usage unique ; scan depuis l'app mobile ; calcul des retards (horaires et tolérance paramétrables), du temps effectif (pause déduite), des heures supplémentaires ; régularisations validées par la RH, avec création du pointage manquant ; historique mobile. |
| **Badges** (§3.2) | Badge virtuel avec QR dans l'app ; badge imprimable recto/verso au format carte CR80 (PDF) ; révocation instantanée ; contrôle d'un badge scanné. |
| **Moteur documentaire** (§3.3) | Modèles versionnés à variables, rendus en **PDF**, **Word** et **PowerPoint** à l'en-tête NTEMO (attestation de travail, ordre de mission, CDD, lettre administrative, présentation commerciale) ; bilan mensuel de présence **Excel** avec formules ; bilan de projet PowerPoint ; empreinte SHA-256 de chaque fichier. |
| **Dossiers RH** (§3.4) | Fiche collaborateur, service, poste, responsable direct, contrats (CDI, CDD, stage…), pièces jointes (GED : CNI, CV, diplômes, contrats signés), création du compte de connexion ; alertes de fin d'essai, de fin de CDD et de pièces expirées. |
| **Tableau de bord** (§3.5) | Taux de présence, retards, absences, validations en attente, documents générés, tâches en retard, tendance sur 7 jours, pointages du jour. |
| **Congés** (§3.5) | Demande (web et mobile), soldes par type, circuit N+1 puis RH, calendrier partagé de l'équipe. |
| **Projets et tâches** (§3.5) | Projets, attribution de tâches avec notification, échéances et alertes de retard, feuilles de temps validées par le responsable. |
| **Assistant NTEMO AI** (§3.5) | Discussion et rédaction assistée (courriers, fiches de poste, clauses, synthèses, plans de présentation) avec Claude d'Anthropic ; mode démonstration sans clé API. |
| **Rôles et sécurité** (§4) | RBAC fin (Super Admin, Direction, RH, Responsable de projet, Collaborateur), séparation des tâches (pas d'auto-validation), cloisonnement par organisation, journal d'audit consultable. |

---

## Démarrage en local

Prérequis : PHP 8.3+ (extensions `pdo_pgsql`, `gd`, `zip`, `mbstring`, `xml`), Composer, PostgreSQL, Node.js 22, Flutter 3.47+ et Android Studio.

### 1. API

```bash
cd backend
cp .env.example .env          # renseigner DB_* ; ANTHROPIC_API_KEY est facultatif
composer install
php artisan key:generate
php artisan migrate --seed    # structure + données de démonstration
php -d upload_max_filesize=12M -d post_max_size=12M artisan serve
```

### 2. Portail web

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1 npm run dev   # http://localhost:3000
```

### 3. Application mobile

```bash
cd mobile
flutter pub get
flutter emulators --launch <émulateur>
flutter run                                          # émulateur Android : API sur 10.0.2.2
flutter run --dart-define=API_BASE_URL=http://<IP-du-PC>:8000/api/v1   # téléphone réel
```

Pour un téléphone réel, lancer l'API avec `--host=0.0.0.0`.

### Comptes de démonstration

Mot de passe commun : `password`.

| Compte | Rôle |
|---|---|
| `admin@ntemo.com` | Super administrateur |
| `direction@ntemo.com` | Direction générale (accès complet, journal d'audit) |
| `rh@ntemo.com` | RH / Administration (borne de pointage, documents, badges, congés) |
| `manager@ntemo.com` | Responsable de projet (équipe, tâches, feuilles de temps) |
| `collaborateur@ntemo.com` | Collaborateur (app mobile : pointage, badge, tâches, congés) |

Parcours de pointage : ouvrir **Pointage** sur le web avec `rh@ntemo.com`, puis scanner le QR depuis l'app mobile connectée avec `collaborateur@ntemo.com`.

---

## Tests

```bash
cd backend && php artisan test     # 59 tests, 377 assertions
cd mobile && flutter test          # 11 tests
cd frontend && npx tsc --noEmit && npx next build
```

---

## Mise en production

Voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** : serveur, HTTPS, configuration, sauvegardes, assistant IA et publication de l'application mobile.
