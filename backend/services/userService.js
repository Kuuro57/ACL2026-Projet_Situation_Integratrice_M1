import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ApplicationError } from "../errors/applicationError.js";

// On fait les mêmes vérifs pour la création et la connexion.
// Ça évite aussi de planter dans le hash si on reçoit un nombre ou un objet.
function validateCredentials(username, password) {
    if (typeof username !== "string" || !username.trim()
        || typeof password !== "string" || !password) {
        throw new ApplicationError(
            "INVALID_USER_INPUT",
            "Le nom d'utilisateur et le mot de passe sont requis."
        );
    }
}

// On applique SHA-256 à la valeur reçue dans password.
function hashPassword(password) {
    return createHash("sha256").update(password).digest("base64");
}

// Le front doit pas récupérer le hash du mdp, donc on garde juste ces 3 champs.
function toPublicUser({ id, username, email }) {
    return { id, username, email };
}

export class UserService {
    constructor(userRepository, { secret }) {
        this.userRepository = userRepository;
        this.secret = secret;
    }

    // On vérifie les infos reçues, puis on prépare l'id et le hash avant de sauvegarder.
    // L'email est facultatif : s'il est absent, on met null en BDD.
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

    // On récupère le compte et on compare le hash avec celui du mdp envoyé.
    // Si c'est bon, on crée un JWT valable 1 jour et on renvoie les infos publiques.
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

    // Le middleware passe par ici pour vérifier la signature et la date du token.
    // On distingue le cookie absent d'un token invalide ou expiré.
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

    // Pour /me, on reprend les infos du JWT déjà vérifié par le middleware.
    // On garde la réponse actuelle, avec id, username, iat et exp.
    getCurrentUser(authenticatedUser) {
        if (!authenticatedUser?.id) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }

        return authenticatedUser;
    }
}
