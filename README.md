# Projet_Situation_Integratrice_M1    

Nilecramm : Marcelin Ray     
Kuuro57 : Noah Allart   
Maev975 : Maxence Eva   
EliasKho : Elias Khodjaoui    
GabinM : Gabin Mathieu   
BaptisteHeq : Baptiste Hennequin

## Backend

Le backend suit la chaîne `Controller → Service → Repository → DAO → SQLite` :

| Dossier | Responsabilité |
| --- | --- |
| `backend/controllers/` | Lire la requête HTTP, appeler un service et produire la réponse (statut, JSON, cookie). |
| `backend/services/` | Appliquer la logique métier : validation, UUID, hash des mots de passe et JWT. |
| `backend/repositories/` | Convertir les données de stockage en objets utilisateur et traduire les conflits de données. |
| `backend/dao/` | Exécuter les requêtes SQL paramétrées. |
| `backend/database/` | Ouvrir et initialiser la base SQLite. |

`backend/app.js` assemble les couches et déclare les routes. `backend/server.js` charge la configuration et démarre l'écoute HTTP. Les dépendances sont passées aux constructeurs pour pouvoir utiliser une base SQLite en mémoire dans les tests.

### Lancer le projet

```sh
npm install
cp .env.example .env
# Définir un SECRET aléatoire dans .env avant de démarrer.
npm start
```

### Routes utilisateur

- `POST /users/add` : création avec `username`, `password` et `email` facultatif, dans un corps JSON/formulaire ou les paramètres de requête existants.
- `POST /users/login` : connexion avec `username` et `password` dans le corps ; le JWT est placé dans le cookie `accessToken`.
- `GET /users/me` : retourne les données du JWT vérifié, avec le cookie de connexion.

### Routes calendrier

Ces routes utilisent aussi le cookie `accessToken`.

| Méthode | Route | Réponse |
| --- | --- | --- |
| `POST` | `/calendars` | `201` avec le calendrier créé. |
| `GET` | `/calendars/:calendarId/:period` | `200` avec la période demandée (`day`, `week` ou `month`) et ses rendez-vous. |

`POST /calendars` attend `{"name":"Perso"}` (texte non vide, aucun autre champ) dans un corps JSON/formulaire. L'utilisateur connecté devient `proprietaire` du calendrier. La réponse contient `id`, `name` et `permission`.

`GET /calendars/:calendarId/:period` est accessible à tous les membres du calendrier, y compris les `visiteur`. `:period` vaut `day`, `week` ou `month` ; toute autre valeur renvoie `400`. Deux paramètres facultatifs choisissent la période :

- `date` : un jour compris dans la période voulue, au format `AAAA-MM-JJ` (aujourd'hui par défaut) ;
- `timeZone` : le fuseau IANA dans lequel la période est découpée, par exemple `America/New_York` (`Europe/Paris` par défaut). Côté navigateur, il s'obtient avec `Intl.DateTimeFormat().resolvedOptions().timeZone`.

Les bornes sont calculées à l'heure locale du fuseau, avec Luxon qui gère les changements d'heure :

| `:period` | Début (inclus) | Fin (exclue) |
| --- | --- | --- |
| `day` | le jour de `date` à 00:00 | le lendemain à 00:00 |
| `week` | le lundi à 00:00 | le lundi suivant à 00:00 |
| `month` | le 1er du mois à 00:00 | le 1er du mois suivant à 00:00 |

Exemple : `GET /calendars/1/week?date=2026-10-14` renvoie

```json
{
  "calendar": { "id": 1, "name": "Perso", "permission": "proprietaire" },
  "period": {
    "start": "2026-10-11T22:00:00.000Z",
    "end": "2026-10-18T22:00:00.000Z",
    "timeZone": "Europe/Paris"
  },
  "events": [
    { "id": 4, "calendarId": 1, "start": "2026-10-14T10:00:00.000Z", "duration": 60,
      "title": "Rendez-vous de projet", "description": null, "reminderTime": null }
  ]
}
```

Avec la même date, `day` renvoie `2026-10-13T22:00:00.000Z` → `2026-10-14T22:00:00.000Z` et `month` renvoie `2026-09-30T22:00:00.000Z` → `2026-10-31T23:00:00.000Z` (le passage à l'heure d'hiver le 25 octobre décale la fin d'une heure en UTC).

`period.start` et `period.end` sont les bornes de la période en UTC (`end` exclu). `events` contient les rendez-vous qui chevauchent cette période, y compris ceux commencés avant son début, triés par date de début.

Erreurs : `400` pour un nom, un identifiant, une période, une date ou un fuseau invalide, `401` sans authentification valide ou si le compte connecté a été supprimé, `403` si l'utilisateur n'est pas membre du calendrier, `404` si le calendrier n'existe pas.

### Routes rendez-vous

Ces routes utilisent le cookie `accessToken` obtenu à la connexion. Le calendrier doit déjà exister et l'utilisateur doit y être `proprietaire` ou `editeur` dans `calendarUser` ; un `visiteur` ne peut pas écrire. Les données viennent du corps JSON de la requête.

| Méthode | Route | Réponse |
| --- | --- | --- |
| `POST` | `/calendars/:calendarId/events` | `201` avec le rendez-vous créé. |
| `PATCH` | `/calendars/:calendarId/events/:eventId` | `200` avec le rendez-vous mis à jour. |
| `DELETE` | `/calendars/:calendarId/events/:eventId` | `204`, sans corps. |

Exemple de création dans le calendrier `1` :

```http
POST /calendars/1/events
Content-Type: application/json
Cookie: accessToken=<JWT de connexion>

{
  "start": "2026-10-15T09:00:00+02:00",
  "duration": 60,
  "title": "Rendez-vous de projet",
  "description": "Faire le point sur le sprint",
  "reminderTime": 15
}
```

`start` doit être une date ISO réelle avec un fuseau (`Z` ou un décalage), puis est enregistrée en UTC. `duration` est un entier strictement positif en minutes. `title` est un texte non vide. `description` est facultatif (texte ou `null`) et `reminderTime` est facultatif (entier supérieur ou égal à zéro, en minutes avant le rendez-vous, ou `null` pour aucun rappel).

La réponse contient `id`, `calendarId`, `start`, `duration`, `title`, `description` et `reminderTime`. Les champs facultatifs absents à la création valent `null`.

Pour modifier uniquement le titre, envoyer par exemple `PATCH /calendars/1/events/5` avec `{"title":"Nouveau titre"}`. Les champs absents restent inchangés. Pour effacer une description ou un rappel, envoyer explicitement `null`. Un corps vide ou un champ inconnu est refusé.

Un rendez-vous peut être lié à plusieurs calendriers. Sa modification ou sa suppression concerne le rendez-vous complet et nécessite donc les droits d'écriture sur **tous** ses calendriers. La suppression enlève aussi ses liens avec les calendriers, tags et fréquences grâce aux clés étrangères.

Les erreurs sont renvoyées en JSON : `400` pour des données, identifiants ou un JSON invalides, `401` sans authentification valide, `403` sans droits, `404` si le calendrier ou le rendez-vous dans ce calendrier n'existe pas, `413` si le corps dépasse la limite Express de 100 Ko, et `500` pour une erreur interne.

### Mots de passe

On utilise Argon2id côté serveur, recommandé aujourd'hui pour stocker les mots de passe plutôt qu'un SHA-256 seul comme vu en cours ([recommandations OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Les paramètres utilisés sont 19 Mio de mémoire, 2 passages et un parallélisme de 1, le minimum recommandé par OWASP. La bibliothèque génère un sel aléatoire et stocke le sel et les paramètres avec le hash dans `password_hash`.

À la connexion, `argon2.verify` vérifie la valeur reçue avec le hash enregistré. 

### Tests

```sh
npm test
```

Les tests utilisent SQLite en mémoire et ne modifient pas `backend/database/app.db`.
