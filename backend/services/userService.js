import { randomUUID } from "node:crypto";
import argon2 from "argon2";
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

// On utilise Argon2id, recommandé aujourd'hui pour stocker les mdp (OWASP).
// Le SHA-256 vu en cours est trop rapide pour ça. La lib ajoute un sel aléatoire par hash.
// Le front envoie un sha-256 du mot de passe, mais on le re-hash côté serveur pour la BDD avec Argon2id.
function hashPassword(password) {
    return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19 * 1024,
        timeCost: 2,
        parallelism: 1
    });
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
    async create(data) {
        const { username, email, password } = data ?? {};
        validateCredentials(username, password);

        if (email != null && typeof email !== "string") {
            throw new ApplicationError("INVALID_USER_INPUT", "L'email doit être une chaîne de caractères.");
        }

        const user = this.userRepository.create({
            id: randomUUID(),
            username,
            email: email ?? null,
            passwordHash: await hashPassword(password)
        });

        return toPublicUser(user);
    }

    // On récupère le compte et la lib vérifie le mdp avec le sel contenu dans le hash stocké.
    // Si c'est bon, on crée un JWT valable 1 jour et on renvoie les infos publiques.
    async login(data) {
        const { username, password } = data ?? {};
        validateCredentials(username, password);

        const user = this.userRepository.findByUsername(username);

        if (!user || !await argon2.verify(user.passwordHash, password)) {
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
