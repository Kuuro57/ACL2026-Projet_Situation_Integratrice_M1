import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(join(__dirname, "app.db"));

// Activation des clés étrangères
db.pragma("foreign_keys = ON");

// On regarde si la BDD est déjà initialisé
const isInitialized = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'")
    .get();

if (!isInitialized) {
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    db.transaction(() => db.exec(schema))();
    console.log("Base de données initialisée depuis schema.sql");
}

export default db;
