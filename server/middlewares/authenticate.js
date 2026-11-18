import { ApplicationError } from "../errors/applicationError.js";

/**
 * Crée le middleware d'authentification lié au service utilisateur
 * @param {import("../services/userService.js").UserService} userService Service utilisateur
 * @returns {import("express").RequestHandler} Middleware qui vérifie que l'utilisateur est authentifié
 */
export function createAuthenticate(userService) {

    /**
     * Authentifie l'utilisateur à partir du cookie accessToken.
     * Si le token est valide, son contenu est placé dans res.locals.user
     * @param {import("express").Request} req Requête
     * @param {import("express").Response} res Réponse
     * @param {import("express").NextFunction} next Fonction à appeler pour passer à la route suivante
     * @returns {void | import("express").Response} Appel à next(), ou réponse 401
     */
    return function authenticate(req, res, next) {
        try {
            res.locals.user = userService.verifyAccessToken(req.cookies?.accessToken);
            return next();
        } catch (error) {
            if (error instanceof ApplicationError
                && ["AUTHENTICATION_REQUIRED", "INVALID_TOKEN"].includes(error.code)) {
                return res.status(401).json({ error: error.message });
            }

            return next(error);
        }
    };
}
