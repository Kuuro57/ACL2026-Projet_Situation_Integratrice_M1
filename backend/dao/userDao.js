/**
 * Accès direct à la table user de la base de données
 */
export class UserDAO {
    
    /**
     * @param {import("better-sqlite3").Database} database Base de données SQLite
     */
    constructor(database) {
        this.database = database;
    }

    /**
     * Insère un utilisateur dans la table user
     * @param {Object} row Ligne à insérer
     * @param {string} row.id Identifiant (UUID)
     * @param {string} row.username Nom d'utilisateur
     * @param {?string} row.email Email (ou null)
     * @param {string} row.password_hash Hash du mot de passe
     * @returns {import("better-sqlite3").RunResult} Résultat de l'INSERT (changes, lastInsertRowid)
     * @throws {import("better-sqlite3").SqliteError} Si une contrainte de la table n'est pas respectée
     */
    create({ id, username, email, password_hash }) {
        return this.database.prepare(
            "INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)"
        ).run(id, username, email, password_hash);
    }

    /**
     * Cherche un compte par son pseudo.
     * @param {string} username Nom d'utilisateur recherché
     * @returns {{ id: string, username: string, email: ?string, password_hash: string } | undefined}
     * La ligne trouvée, ou undefined si rien n'a été trouvé
     */
    findByUsername(username) {
        return this.database.prepare(
            "SELECT id, username, email, password_hash FROM user WHERE username = ?"
        ).get(username);
    }
}
