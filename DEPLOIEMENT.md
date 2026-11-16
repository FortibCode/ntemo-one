# Mise en production de NTEMO ONE

Guide de déploiement pour le lancement officiel (phase 4 du cahier des charges). Il suppose un serveur Linux (Ubuntu 24.04 LTS ou Fedora) accessible en HTTPS, par exemple `api.ntemo-one.com` pour l'API et `app.ntemo-one.com` pour le portail.

---

## 1. Serveur

| Élément | Recommandation |
|---|---|
| Machine | 2 vCPU, 4 Go de RAM, 40 Go SSD (à ajuster selon l'effectif) |
| Logiciels | Nginx, PHP-FPM 8.3+, PostgreSQL 16+, Node.js 22, Composer, Certbot |
| Extensions PHP | `pdo_pgsql`, `gd`, `zip`, `mbstring`, `xml`, `intl`, `fileinfo`, `opcache` |
| Pare-feu | Ports 80 et 443 ouverts ; PostgreSQL (5432) fermé à l'extérieur |

**HTTPS est obligatoire.** L'application mobile publiée refuse le HTTP, les jetons de connexion ne doivent jamais circuler en clair, et la caméra du navigateur exige un contexte sécurisé. Avec Nginx : `certbot --nginx -d api.ntemo-one.com -d app.ntemo-one.com`.

---

## 2. API (backend)

```bash
cd /var/www/ntemo-one/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force        # rôles, permissions, types de congé, modèles documentaires
php artisan config:cache && php artisan route:cache
```

Le seeder crée aussi les comptes et données de démonstration. En production, supprimez ces comptes ou changez leurs mots de passe immédiatement, puis créez les vrais collaborateurs et leurs comptes depuis **Collaborateurs → Ouvrir → Compte**.

### Variables `.env` essentielles

| Variable | Valeur en production |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` |
| `APP_URL` | `https://api.ntemo-one.com` |
| `APP_LOCALE` | `fr` |
| `DB_*` | Base dédiée, utilisateur avec mot de passe fort (pas `postgres`) |
| `CORS_ALLOWED_ORIGINS` | `https://app.ntemo-one.com` (l'adresse du portail ; `*` uniquement en développement) |
| `ANTHROPIC_API_KEY` | Clé de l'assistant IA (voir section 5), facultative |

`config/app.php` force le fuseau `UTC` pour le stockage. C'est voulu : les calculs (retards, journées, alertes) utilisent le fuseau de l'organisation, réglable dans **Paramètres**.

### PHP et Nginx

- `php.ini` : `upload_max_filesize = 12M` et `post_max_size = 12M`, pour les pièces RH de 10 Mo (2 Mo par défaut).
- Nginx : `client_max_body_size 12M;` et une racine sur `backend/public`.
- Les fichiers privés (documents générés, pièces RH) sont dans `backend/storage/app/private` : ce dossier ne doit **jamais** être servi directement, et il doit être accessible en écriture par PHP-FPM.

---

## 3. Portail web (frontend)

```bash
cd /var/www/ntemo-one/frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.ntemo-one.com/api/v1 npm run build
npm run start -- -p 3000          # à placer derrière Nginx, avec systemd ou pm2
```

`NEXT_PUBLIC_API_URL` est lue **au moment du build** : reconstruisez le portail si l'adresse de l'API change.

L'adresse du portail doit figurer dans `CORS_ALLOWED_ORIGINS` côté API (section 2).

---

## 4. Application mobile

1. Construire avec l'adresse de production :
   ```bash
   cd mobile
   flutter build appbundle --release --dart-define=API_BASE_URL=https://api.ntemo-one.com/api/v1   # Android
   flutter build ipa --release --dart-define=API_BASE_URL=https://api.ntemo-one.com/api/v1         # iOS (sur macOS)
   ```
2. **Android :** créer une clé de signature (`keytool`), la déclarer dans `android/key.properties` (fichier à ne pas versionner), puis publier sur Google Play, éventuellement en test interne d'abord.
3. **iOS :** un compte Apple Developer est nécessaire ; la publication passe par App Store Connect ou TestFlight.
4. L'identifiant d'application est `com.ntemo.ntemo_one_mobile`. Changez-le **avant** la première publication si vous en voulez un autre : il ne pourra plus être modifié ensuite.

La version debug autorise le HTTP pour les tests en local ; la version publiée exige HTTPS.

---

## 5. Assistant NTEMO AI (facultatif)

Sans clé, l'assistant fonctionne en **mode démonstration** et l'indique aux utilisateurs.

Pour l'activer :

1. Créer une clé API sur https://platform.claude.com, avec facturation à l'usage. Prévoir un plafond de dépenses mensuel dans la console.
2. Renseigner dans `.env` :
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   NTEMO_AI_MODEL=claude-opus-5-5
   NTEMO_AI_EFFORT=low
   NTEMO_AI_MAX_TOKENS=8000
   ```
3. `php artisan config:cache`

Les textes saisis par les utilisateurs sont envoyés à Anthropic pour être traités ; aucune donnée de dossier RH n'est jointe automatiquement. Informez-en les utilisateurs dans la charte informatique. `NTEMO_AI_EFFORT` règle la profondeur de réflexion du modèle : `low` répond vite et coûte moins, `medium` ou `high` donnent des rédactions plus approfondies.

---

## 6. Sauvegardes et exploitation

- **Base de données :** sauvegarde quotidienne chiffrée, conservée hors du serveur.
  ```bash
  pg_dump -Fc ntemo_one > /backups/ntemo_one_$(date +%F).dump
  ```
- **Fichiers :** sauvegarder `backend/storage/app/private` (documents générés, pièces RH) avec la même fréquence.
- **Restauration :** testez-la au moins une fois avant le lancement (`pg_restore`).
- **Journaux :** `backend/storage/logs` (avec rotation) ; le journal d'audit fonctionnel se consulte dans le portail (**Administration → Journal d'audit**).
- **Mises à jour de sécurité :** `composer audit` et `npm audit` chaque mois, puis `php artisan test` avant de déployer.

---

## 7. Liste de vérification avant le lancement

- [ ] HTTPS actif sur l'API et le portail
- [ ] `APP_DEBUG=false`, `CORS_ALLOWED_ORIGINS` limité au portail
- [ ] Comptes de démonstration supprimés ou mots de passe changés
- [ ] Paramètres de l'organisation remplis (horaires, jours ouvrés, quotas de congés, fuseau)
- [ ] Bornes de pointage créées pour chaque entrée, et tablettes connectées avec un compte RH ou un compte dédié
- [ ] Collaborateurs importés, avec service, poste, responsable direct, contrat et compte de connexion
- [ ] Badges émis et imprimés
- [ ] Sauvegardes automatiques en place et restauration testée
- [ ] Application mobile publiée et testée sur un vrai téléphone (scan du QR de la borne)
- [ ] Formation des RH et des responsables, puis communication aux collaborateurs
