import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ApplicationError } from "../errors/applicationError.js";

function validateCredentials(username, password) {
    if (typeof username !== "string" || !username.trim()
        || typeof password !== "string" || !password) {
        throw new ApplicationError(
            "INVALID_USER_INPUT",
            "Le nom d'utilisateur et le mot de passe sont requis."
        );
    }
}

// Conserve le format des mots de passe déjà stockés dans la base.
function hashPassword(password) {
    return createHash("sha256").update(password).digest("base64");
}

function toPublicUser({ id, username, email }) {
    return { id, username, email };
}

export class UserService {
    constructor(userRepository, { secret }) {
        this.userRepository = userRepository;
        this.secret = secret;
    }

    create(data) {
        const { username, email, password } = data ?? {};
        validateCredentials(username, password);

        if (email != null && typeof email !== "string") {
            throw new ApplicationError("INVALID_USER_INPUT", "L'email doit être une chaîne de caractères.");
        }

        const user = this.userRepository.create({
            id: randomUUID(),
            username,
            email: email ?? null,
            passwordHash: hashPassword(password)
        });

        return toPublicUser(user);
    }

    login(data) {
        const { username, password } = data ?? {};
        validateCredentials(username, password);

        const user = this.userRepository.findByUsername(username);

        if (!user || user.passwordHash !== hashPassword(password)) {
            throw new ApplicationError(
                "INVALID_CREDENTIALS",
                "Nom d'utilisateur ou mot de passe incorrect."
            );
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            this.secret,
            { expiresIn: "1d" }
        );

        return { user: toPublicUser(user), token };
    }

    verifyAccessToken(token) {
        if (!token) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }

        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            throw new ApplicationError("INVALID_TOKEN", "Token invalide ou expiré.", { cause: error });
        }
    }

    getCurrentUser(authenticatedUser) {
        if (!authenticatedUser?.id) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }

        // /users/me conserve sa réponse actuelle : les données du JWT vérifié.
        return authenticatedUser;
    }
}
