import { ApplicationError } from "../errors/applicationError.js";

const errorStatuses = {
    INVALID_USER_INPUT: 400,
    INVALID_CREDENTIALS: 401,
    AUTHENTICATION_REQUIRED: 401,
    INVALID_TOKEN: 401,
    USERNAME_ALREADY_EXISTS: 409,
    EMAIL_ALREADY_EXISTS: 409,
    USER_ALREADY_EXISTS: 409
};

/**
 * Traduit les erreurs connues en codes HTTP (400, 401, 409)
 * @param {Error} error Erreur levée
 * @param {import("express").Response} res Réponse
 * @param {string} fallbackMessage Message renvoyé au client si l'erreur est imprévue
 * @returns {import("express").Response} Réponse JSON contenant le message d'erreur
 */
function respondToError(error, res, fallbackMessage) {
    const status = error instanceof ApplicationError && errorStatuses[error.code];

    if (status) {
        return res.status(status).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: fallbackMessage });
}

/**
 * Crée le contrôleur utilisateur
 * On passe le service au contrôleur pour qu'il n'ait pas besoin de toucher à la BDD
 * @param {import("../services/userService.js").UserService} userService Service utilisateur
 * @returns {*}
 * Les handlers des routes utilisateur
 */
export function createUserController(userService) {
    return {
        /**
         * Crée un utilisateur
         * @param {import("express").Request} req Requête
         * @param {import("express").Response} res Réponse
         * @returns {Promise<import("express").Response>} Utilisateur créé (201) ou erreur
         */
        async create(req, res) {
            try {
                const user = await userService.create(req.body ?? req.query);
                return res.status(201).json(user);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la création de l'utilisateur.");
            }
        },

        /**
         * Connecte un utilisateur
         * @param {import("express").Request} req Requête
         * @param {import("express").Response} res Réponse
         * @returns {Promise<import("express").Response>} Utilisateur connecté (200) ou erreur
         */
        async login(req, res) {
            try {
                const { user, token } = await userService.login(req.body ?? req.query);

                res.cookie("accessToken", token, {
                    httpOnly: false,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 24 * 60 * 60 * 1000
                });

                return res.status(200).json({ user });
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la connexion.");
            }
        },

        /**
         * Renvoie l'utilisateur actuellement connecté
         * @param {import("express").Request} req Requête
         * @param {import("express").Response} res Réponse
         * @returns {import("express").Response} Utilisateur connecté (200) ou erreur
         */
        me(req, res) {
            try {
                const user = userService.getCurrentUser(res.locals.user);
                return res.status(200).json({ user });
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la récupération de l'utilisateur.");
            }
        }
    };
}
