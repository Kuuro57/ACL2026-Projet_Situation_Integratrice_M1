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

function respondToError(error, res, fallbackMessage) {
    const status = error instanceof ApplicationError && errorStatuses[error.code];

    if (status) {
        return res.status(status).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: fallbackMessage });
}

export function createUserController(userService) {
    return {
        create(req, res) {
            try {
                // Accepte un corps JSON/formulaire et les anciens paramètres de requête.
                const user = userService.create(req.body ?? req.query);
                return res.status(201).json(user);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la création de l'utilisateur.");
            }
        },

        login(req, res) {
            try {
                const { user, token } = userService.login(req.body);

                res.cookie("accessToken", token, {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 24 * 60 * 60 * 1000
                });

                return res.status(200).json({ user });
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la connexion.");
            }
        },

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
