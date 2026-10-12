import dotenv from "dotenv";
import db from "./database/db.js";
import { createApp } from "./app.js";

dotenv.config();

const app = createApp({ database: db, secret: process.env.SECRET });
const port = 3000;

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
