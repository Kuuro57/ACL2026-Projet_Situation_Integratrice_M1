import { ApplicationError } from "../errors/applicationError.js";

/**
 * Fait le lien entre les objets du service et les lignes SQL renvoyées par le DAO
 */
export class UserRepository {
    
    /**
     * @param {import("../dao/userDao.js").UserDAO} userDao DAO utilisateur
     */
    constructor(userDao) {
        this.userDao = userDao;
    }

    /**
     * Enregistre un utilisateur
     * @param {Object} user Utilisateur à enregistrer
     * @param {string} user.id Identifiant (UUID)
     * @param {string} user.username Nom d'utilisateur
     * @param {?string} [user.email=null] Email facultatif
     * @param {string} user.passwordHash Hash du mot de passe
     * @returns {{ id: string, username: string, email: ?string, passwordHash: string }} Utilisateur enregistré
     * @throws {ApplicationError} USERNAME_ALREADY_EXISTS, EMAIL_ALREADY_EXISTS ou USER_ALREADY_EXISTS
     * en cas de contrainte UNIQUE non respectée
     */
    create({ id, username, email = null, passwordHash }) {
        try {
            this.userDao.create({ id, username, email, password_hash: passwordHash });
        } catch (error) {
            if (error.code !== "SQLITE_CONSTRAINT_UNIQUE") {
                throw error;
            }

            if (error.message.includes("user.username")) {
                throw new ApplicationError(
                    "USERNAME_ALREADY_EXISTS",
                    "Ce nom d'utilisateur est déjà utilisé.",
                    { cause: error }
                );
            }

            if (error.message.includes("user.email")) {
                throw new ApplicationError(
                    "EMAIL_ALREADY_EXISTS",
                    "Cet email est déjà associée à un compte.",
                    { cause: error }
                );
            }

            throw new ApplicationError(
                "USER_ALREADY_EXISTS",
                "Impossible d'ajouter l'utilisateur (erreur de contrainte UNIQUE).",
                { cause: error }
            );
        }

        return { id, username, email, passwordHash };
    }

    /**
     * Cherche un utilisateur par son nom d'utilisateur
     * @param {string} username Nom d'utilisateur recherché
     * @returns {?{ id: string, username: string, email: ?string, passwordHash: string }}
     * Utilisateur trouvé, ou null s'il n'existe pas
     */
    findByUsername(username) {
        const row = this.userDao.findByUsername(username);

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            username: row.username,
            email: row.email,
            passwordHash: row.password_hash
        };
    }
}
