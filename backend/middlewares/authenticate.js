import { ApplicationError } from "../errors/applicationError.js";

// Avant une route protégée, on demande au service de vérifier le cookie accessToken.
// Si ça passe, les infos du user sont dans res.locals.user pour le contrôleur suivant.
export function createAuthenticate(userService) {
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
