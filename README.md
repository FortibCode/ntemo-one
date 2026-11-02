# NTEMO ONE — Plateforme Intégrée RH, Présences & Projets

Plateforme d'entreprise développée pour **NTEMO Consulting** selon une architecture propre, modulaire et hautement sécurisée.

---

## 1. Stack Technique Imposée

- **Backend :** Laravel 12 / PHP 8.3 / PostgreSQL 18
  - API RESTful versionnée sous `/api/v1` (31 endpoints).
  - Authentification sécurisée multi-client via Laravel Sanctum (Bearer Tokens révocables).
  - Architecture isolée multi-tenant par `organization_id` avec UUIDs v4 sur toutes les tables.
  - Sécurité RBAC complète (Rôles & Permissions fines).
  - Immutabilité stricte des événements bruts de pointage.
- **Frontend Web :** Next.js 16 (React 19 / TypeScript / Tailwind CSS)
  - Portail d'administration responsive, gestion des collaborateurs et filtres en temps réel.
- **Mobile :** Flutter / Dart
  - Architecture modulaire par fonctionnalités (`attendance`, `badge`, `leaves`, `profile`).
  - Scanner QR Code dynamique (validité 15s) et Badge Virtuel d'identification.

---

## 2. Synthèse des Modules Implémentés

| Module | Fonctionnalités Clés | Endpoints Principaux |
| :--- | :--- | :--- |
| **Authentification & RBAC** | Connexion sécurisée, profil `me`, déconnexion, contrôle des rôles et permissions | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| **Dossiers Employés & RH** | Matricules incrémentaux automatiques (`NTM-AAAA-0001`), historisation des affectations | `GET /employees`, `POST /employees`, `GET /employees/{id}` |
| **Présences & Pointage QR** | QR code dynamique à expiration stricte de 15s, signature HMAC-SHA256, anti-rejeu | `POST /attendance/qr-session`, `POST /attendance/punch` |
| **Badges Virtuels** | Cycle de vie des badges, remplacement automatique lors de réémission, scan de contrôle | `GET /badges/my-badge`, `POST /badges/issue`, `POST /badges/verify` |
| **Congés & Approbations** | Décompte en jours ouvrés, réservation de solde, circuit N+1 -> Direction RH | `GET /leaves/my-requests`, `POST /leaves/requests`, `/review-n1`, `/review-hr` |
| **Moteur Documentaire** | Modèles versionnés (DOCX/XLSX/PDF), fusion contextuelle de balises, empreinte SHA-256 | `GET /documents/templates`, `POST /documents/generate`, `GET /download/{id}` |
| **Notifications & Alertes** | Alertes in-app en temps réel, compteur de non-lus, historique d'expédition multi-canal | `GET /notifications`, `POST /notifications/{id}/read`, `POST /read-all` |
| **Projets & Feuilles de Temps**| Déclaration d'heures par tâche/projet, validation ou rejet argumenté par le chef de projet | `GET /projects`, `POST /timesheets/log`, `POST /timesheets/{id}/review` |
| **Tableaux de Bord (KPIs)** | Effectifs, taux de présence du jour, retards, congés en attente, heures cumulées | `GET /dashboard/kpis` |
| **Assistant IA Documentaire** | Rédaction assistée de fiches de poste et clauses contractuelles avec validation humaine | `GET /ai/conversations`, `POST /ai/conversations/{id}/messages`, `POST /ai/tasks/draft` |

---

## 3. Exécution des Tests Automatisés

```bash
cd backend
php artisan test
```

Résultat : **22 tests réussis (103 assertions) — 100% succès**.

---

## 4. Démarrage Rapide

### Backend (Laravel)
```bash
cd backend
php artisan serve
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev
```
