import { ApplicationError } from "../errors/applicationError.js";

const errorStatuses = {
    INVALID_EVENT_INPUT: 400,
    AUTHENTICATION_REQUIRED: 401,
    CALENDAR_ACCESS_DENIED: 403,
    CALENDAR_NOT_FOUND: 404,
    EVENT_NOT_FOUND: 404
};

// On renvoie les erreurs prévues en JSON. Les détails d'une panne SQL restent dans la console.
function respondToError(error, res, fallbackMessage) {
    const status = error instanceof ApplicationError && errorStatuses[error.code];
    if (status) {
        return res.status(status).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: fallbackMessage });
}

/**
 * Les routes récupèrent l'utilisateur connecté et passent les données au service.
 * Le contrôleur gère seulement les paramètres HTTP et la réponse.
 */
export function createEventController(eventService) {
    return {
        // On renvoie les données du rendez-vous créé, avec son id généré par SQLite.
        create(req, res) {
            try {
                const event = eventService.create(res.locals.user?.id, req.params.calendarId, req.body);
                return res.status(201).json(event);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la création du rendez-vous.");
            }
        },

        // Le body contient uniquement les champs que le client veut modifier.
        update(req, res) {
            try {
                const event = eventService.update(
                    res.locals.user?.id, req.params.calendarId, req.params.eventId, req.body
                );
                return res.status(200).json(event);
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la modification du rendez-vous.");
            }
        },

        // Une suppression réussie renvoie 204, sans corps de réponse.
        delete(req, res) {
            try {
                eventService.delete(res.locals.user?.id, req.params.calendarId, req.params.eventId);
                return res.status(204).end();
            } catch (error) {
                return respondToError(error, res, "Erreur lors de la suppression du rendez-vous.");
            }
        }
    };
}
