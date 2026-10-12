import { ApplicationError } from "../errors/applicationError.js";

export class UserRepository {
    constructor(userDao) {
        this.userDao = userDao;
    }

    // On fait le lien entre l'objet du service et les noms de colonnes en BDD.
    // Si le pseudo ou l'email est déjà pris, on remonte une erreur plus lisible que celle de SQLite.
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

    // Le DAO renvoie une ligne SQL : on la transforme en objet utilisable par le service.
    // Ici on garde le hash, il sert à vérifier le mdp pendant la connexion.
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
