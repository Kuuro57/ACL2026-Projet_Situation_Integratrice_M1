import dotenv from "dotenv";
import db from "./database/db.js";
import { createApp } from "./app.js";

// On charge le .env avant de récupérer le secret pour l'app.
dotenv.config();

const app = createApp({ database: db, secret: process.env.SECRET });
const port = 3000;

// C'est ici qu'on démarre vraiment le serveur, sur le port 3000 pour l'instant.
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
