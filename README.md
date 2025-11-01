# Covoiturage CI — Robust PoC (NestJS + Redpanda + Postgres + Redis + Meilisearch + Prometheus/Grafana)

Microservices: **bff, identity, ride (outbox), search (idempotence + DLQ), booking (hold), payment (mock), wallet (holds), payouts (mock), notification, config**.

## Lancer
```bash
docker compose up -d --build
# Console Redpanda: http://localhost:8082
# Grafana: http://localhost:3007  (admin / admin)
# Prometheus: http://localhost:9091
# pgAdmin: http://localhost:5050  (connexion directe, aucun mot de passe demandé)
# Administration métier: http://localhost:3006/admin/accounts (connecte-toi avec un compte ADMIN)
```

## Gestion des comptes

- Le premier compte créé est automatiquement promu administrateur pour initialiser la supervision.
- Les administrateurs peuvent lister, promouvoir/déclasser et suspendre les comptes depuis l’interface web (« Administration ») ou via l’API `identity` (`/admin/accounts`).
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
