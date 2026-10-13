import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { ApplicationError } from "../errors/applicationError.js";

/**
 * Vérifie le nom d'utilisateur et le mot de passe reçus
 * @param {string} username Nom d'utilisateur reçu
 * @param {string} password Mot de passe reçu
 * @returns {void}
 * @throws {ApplicationError} INVALID_USER_INPUT si l'un des deux est absent ou n'est pas une chaîne
 */
function validateCredentials(username, password) {
    if (typeof username !== "string" || !username.trim()
        || typeof password !== "string" || !password) {
        throw new ApplicationError(
            "INVALID_USER_INPUT",
            "Le nom d'utilisateur et le mot de passe sont requis."
        );
    }
}

/**
 * Hash un mot de passe avec Argon2id, recommandé aujourd'hui pour stocker les mdp (OWASP).
 * Le SHA-256 vu en cours est trop rapide pour ça. La lib ajoute un sel aléatoire par hash.
 * Le front envoie un SHA-256 du mot de passe, mais on le re-hash côté serveur pour la BDD avec Argon2id.
 * @param {string} password Mot de passe à hasher
 * @returns {Promise<string>} Hash Argon2id (contient le sel et les paramètres)
 */
function hashPassword(password) {
    return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19 * 1024,
        timeCost: 2,
        parallelism: 1
    });
}

/**
 * Garde uniquement les champs publics d'un utilisateur.
 * (Le front ne doit pas récupérer le hash du mdp, donc on garde juste ces 3 champs)
 * @param {{ id: string, username: string, email: ?string }} user Utilisateur complet
 * @returns {{ id: string, username: string, email: ?string }} Utilisateur public
 */
function toPublicUser({ id, username, email }) {
    return { id, username, email };
}





/**
 * Logique métier des utilisateurs
 */
export class UserService {
    
    /**
     * @param {import("../repositories/userRepository.js").UserRepository} userRepository Repository utilisateur
     * @param {Object} options Options du service
     * @param {string} options.secret Clé secrète utilisée pour signer et vérifier les JWT
     */
    constructor(userRepository, { secret }) {
        this.userRepository = userRepository;
        this.secret = secret;
    }

    /**
     * Crée un utilisateur
     * @param {{ username: string, password: string, email?: ?string }} data Infos de l'utilisateur
     * @returns {Promise<{ id: string, username: string, email: ?string }>} Utilisateur public créé
     * @throws {ApplicationError} INVALID_USER_INPUT si les infos sont invalides,
     * ou une erreur de doublon remontée par le repository
     */
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

    /**
     * Connecte un utilisateur
     * @param {{ username: string, password: string }} data Identifiants de connexion
     * @returns {Promise<{ user: { id: string, username: string, email: ?string }, token: string }>}
     * Utilisateur public et JWT signé
     * @throws {ApplicationError} INVALID_USER_INPUT si les infos sont invalides,
     * INVALID_CREDENTIALS si le compte n'existe pas ou si le mot de passe est faux
     */
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

    /**
     * Vérifie un JWT d'accès
     * @param {?string} token JWT récupéré dans le cookie
     * @returns {{ id: string, username: string, iat: number, exp: number }} Contenu décodé du token
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si le token est absent,
     * INVALID_TOKEN s'il est invalide ou expiré
     */
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

    /**
     * Renvoie l'utilisateur connecté
     * @param {?{ id: string, username: string, iat: number, exp: number }} authenticatedUser Contenu du JWT vérifié
     * @returns {{ id: string, username: string, iat: number, exp: number }} Utilisateur connecté
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si aucun utilisateur n'est authentifié
     */
    getCurrentUser(authenticatedUser) {
        if (!authenticatedUser?.id) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }

        return authenticatedUser;
    }
}
