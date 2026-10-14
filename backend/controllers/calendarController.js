import { ApplicationError } from "../errors/applicationError.js";

const errorStatuses = {
    INVALID_CALENDAR_INPUT: 400,
    AUTHENTICATION_REQUIRED: 401,
    CALENDAR_ACCESS_DENIED: 403,
    CALENDAR_NOT_FOUND: 404
};

/**
 * Traduit les erreurs connues en codes HTTP (400, 401, 403, 404)
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
 * Crée le contrôleur des calendriers
 * @param {import("../services/calendarService.js").CalendarService} calendarService Service des calendriers
 * @returns {{ create: import("express").RequestHandler, getWeek: import("express").RequestHandler }}
 * Les handlers des routes calendrier
 */
export function createCalendarController(calendarService) {
    return {
        /**
         * Crée un calendrier
         * @param {import("express").Request} req Requête
         * @param {import("express").Response} res Réponse
         * @returns {import("express").Response} Calendrier créé (201) ou erreur
         */
        create(req, res) {
            try {
                const calendar = calendarService.create(res.locals.user?.id, req.body);
                return res.status(201).json(calendar);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la création du calendrier.");
            }
        },

        /**
         * Renvoie une semaine du calendrier avec ses rendez-vous
         * @param {import("express").Request} req Requête
         * @param {import("express").Response} res Réponse
         * @returns {import("express").Response} Semaine demandée (200) ou erreur
         */
        getWeek(req, res) {
            try {
                const week = calendarService.getWeek(res.locals.user?.id, req.params.calendarId, {
                    date: req.query.date,
                    timeZone: req.query.timeZone
                });
                return res.status(200).json(week);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la récupération de la semaine.");
            }
        }
    };
}
