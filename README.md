# Covoiturage CI — Robust PoC (NestJS + Redpanda + Postgres + Redis + Meilisearch + Prometheus/Grafana)

Microservices: **bff, identity, ride (outbox), search (idempotence + DLQ), booking (hold), payment (mock), wallet (holds), payouts (mock), notification, config**.

## Lancer
```bash
make up
# Ou, sans make :
docker compose up --build --detach
# Console Redpanda: http://localhost:8082
# Grafana: http://localhost:3007  (admin / admin)
# Prometheus: http://localhost:9091
# pgAdmin: http://localhost:5050  (connexion directe, aucun mot de passe demandé)
# Administration métier: http://localhost:3006/admin/accounts (connecte-toi avec un compte ADMIN)
```

## HTTPS en prod + mode local

- **Local** : rien à changer, continue d’utiliser `make up` (ou `docker compose up -d`). Le port `3006` reste exposé directement depuis `webapp`, et Traefik n’est pas démarré car il est derrière un profil Compose (`proxy`).

- **VPS avec HTTPS** :
  1. Crée `app.example.com` → IP du serveur, ouvre les ports 80/443 (`sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`).
  2. Place-toi dans le dossier du projet et crée un `.env` (copie possible depuis `.env.example`) :
     ```bash
     cat <<'EOF' > .env
     WEBAPP_HOST=app.example.com
     TRAEFIK_ACME_EMAIL=ops@example.com
     EOF
     ```
  3. Bâtis/démarre avec le profil proxy :
     ```bash
     docker compose --profile proxy up -d --build traefik webapp
     docker compose --profile proxy up -d
     ```
     (Tu peux remplacer par `make up` puis `docker compose --profile proxy up -d traefik` si tu préfères.)
  4. Vérifie la génération des certificats :
     ```bash
     docker compose --profile proxy logs -f traefik
     ```
  5. Accède ensuite à `https://app.example.com`. Traefik écoute en 80/443, gère Let’s Encrypt via HTTP challenge et reverse-proxy l’app SPA (qui continue de router les `/api/...` vers les microservices internes).

> Besoin d’exposer d’autres services (Grafana, Prometheus, etc.) ? Ajoute-les au réseau `proxy`, configure les labels Traefik (`traefik.http.routers.*`) avec leurs sous-domaines, puis relance `docker compose --profile proxy up -d`.

## Gestion des comptes

- Le premier compte créé est automatiquement promu administrateur pour initialiser la supervision.
- Les administrateurs peuvent lister, promouvoir/déclasser et suspendre les comptes depuis l’interface web (« Administration ») ou via l’API `identity` (`/admin/accounts`).
- Depuis le même tableau de bord, ils peuvent désormais ajuster un trajet (prix, date, capacités), le clôturer, ou encore expédier par email un digest complet (HTML + CSV) des trajets filtrés à n’importe quel utilisateur.
- Une nouvelle section « Catalogue des trajets » leur offre la vue complète des départs à venir et de l’historique, avec filtres dynamiques et actions directes (édition, clôture) sans devoir passer par un compte spécifique.
- Un compte suspendu ne peut plus se reconnecter (mot de passe ou OTP). Les sessions existantes sont neutralisées côté client au prochain rafraîchissement.
- L’espace d’administration affiche maintenant le détail des trajets publiés et des réservations effectuées par chaque utilisateur (statistiques agrégées, volumes financiers, prochaines dates de départ). Les données proviennent des endpoints `identity`/`ride`/`booking` sécurisés par la clé interne (`INTERNAL_API_KEY` dans les fichiers `.env` des services BFF/Ride/Booking/Identity).
- Chaque utilisateur dispose d’un espace « Mon profil » pour définir sa photo, ses préférences de confort et personnaliser l’accueil (thème, message, trajets favoris, raccourcis). Les administrateurs peuvent éditer ces mêmes paramètres pour leurs passagers/conducteurs directement depuis l’onglet Administration.
- Les comptes entreprise disposent désormais d’un module de gestion de flotte : enregistrement des véhicules (caractéristiques, capacités, équipements), planification des départs, suivi des horaires et consultation depuis l’espace admin. Les métriques associées alimentent Prometheus (`ride_fleet_vehicle_total`, `ride_fleet_vehicle_seats_total`, `ride_fleet_upcoming_trips_total`).
- Les métriques Prometheus ont été enrichies : comptes par statut/type, activité OTP et personnalisations (`identity`), sièges disponibles et latence de verrouillage (`ride`), montants et taux d’échec des réservations (`booking`), ainsi que la latence/succès des appels proxy (`bff`). Les dashboards Grafana peuvent ainsi suivre la santé métier et la chaîne de réservation de bout en bout.
- Les filtres de recherche s’alignent désormais sur les usages BlaBlaCar : prix maximal, fenêtre horaire (« après/avant »), et tri (plus tôt, moins cher, plus de places). Les résultats affichent aussi des chips récapitulatives pour partager les critères appliqués.

### Idées de panneaux Grafana

- Comptes actifs / suspendus : `identity_accounts_by_status` (panel "stat" ou aire empilée).
- Personnalisations de profils : `rate(identity_profile_update_total[5m])` avec les labels `actor` et `type`.
- Capacités vs sièges disponibles : comparer `ride_seats_capacity_total` et `ride_seats_available_total`.
- Latence de verrouillage des sièges : `histogram_quantile(0.95, sum(rate(ride_lock_duration_seconds_bucket[5m])) by (le))`.
- Montants réservés : `booking_amount_sum_cfa` et `rate(booking_amount_cfa_sum[5m])`.
- Santé du proxy : ratio `rate(bff_upstream_requests_total{outcome="success"}[5m]) / rate(bff_upstream_requests_total[5m])` et ventilation des `outcome` (succès, 4xx, 5xx).
- Suivi des flottes : `sum(ride_fleet_vehicle_total)` pour la volumétrie, `ride_fleet_vehicle_seats_total` pour la capacité offerte et `ride_fleet_upcoming_trips_total` pour les départs planifiés à horizon proche.

## Données de démonstration
- Pour enrichir rapidement la base avec des comptes et trajets fictifs (toutes les dates jusqu'en 2027) : `npm --prefix services/identity run seed:demo`
- La connexion utilise `SEED_DATABASE_URL` si défini, sinon `DATABASE_URL` (défaut `postgres://app:app@postgres:5432/covoiturage`). Adapte la variable avant d'exécuter si besoin.
- Tu peux surcharger le mot de passe commun via `SEED_ACCOUNT_PASSWORD` (défaut `Motdepasse123!`). Tous les comptes créés ou mis à jour partageront ce mot de passe.
- Le script charge automatiquement `services/identity/.env` (sauf si `SEED_ENV_PATH` pointe ailleurs). Par défaut les valeurs du fichier remplacent celles déjà présentes en variables d'environnement ; désactive ce comportement via `SEED_ENV_OVERRIDE=false`.
- Si tu exécutes la commande depuis ta machine (hors Docker), un fallback automatique bascule l'hôte `postgres` vers `127.0.0.1` (configurable via `SEED_LOCALHOST_HOST`/`SEED_LOCALHOST_PORT`) pour éviter les résolutions DNS externes. Désactive-le avec `SEED_LOCALHOST_FALLBACK=false` si nécessaire.
- `npm run seed:demo` reconstruit le code TypeScript seulement si `tsconfig.json` est présent (ex. exécution depuis le dossier projet) ; dans l'image Docker production où seuls les artefacts compilés sont disponibles, la commande se contente d'exécuter `dist/scripts/bulk-generate.js`.
- Le script est idempotent : il réutilise les comptes existants (basés sur l'email) et ne crée un trajet que s'il n'existe pas déjà pour un conducteur/date/origine/destination donnés.
- Chaque journée (à partir du 1er janvier 2024) reçoit plusieurs départs prédéfinis, ce qui permet de tester les recherches, les métriques et les statistiques administrateur sur un volume conséquent de données.
