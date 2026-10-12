import { ApplicationError } from "../errors/applicationError.js";

export class UserRepository {
    constructor(userDao) {
        this.userDao = userDao;
    }

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
