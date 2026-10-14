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

### Mots de passe

On utilise Argon2id côté serveur, recommandé aujourd'hui pour stocker les mots de passe plutôt qu'un SHA-256 seul comme vu en cours ([recommandations OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Les paramètres utilisés sont 19 Mio de mémoire, 2 passages et un parallélisme de 1, le minimum recommandé par OWASP. La bibliothèque génère un sel aléatoire et stocke le sel et les paramètres avec le hash dans `password_hash`.

À la connexion, `argon2.verify` vérifie la valeur reçue avec le hash enregistré. 

### Tests

```sh
npm test
```

Les tests utilisent SQLite en mémoire et ne modifient pas `backend/database/app.db`.
