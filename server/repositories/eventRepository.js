/**
 * On garde les mêmes champs côté service, sans lui faire connaître les noms des colonnes SQL.
 */
function toEvent(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        calendarId: row.calendar_id,
        start: row.start,
        duration: row.duration,
        title: row.title,
        description: row.description,
        reminderTime: row.reminderTime
    };
}

/**
 * Fait le lien entre les lignes du DAO et les objets utilisés par le service.
 */
export class EventRepository {
    /**
     * @param {import("../dao/eventDao.js").EventDAO} eventDao DAO des rendez-vous
     */
    constructor(eventDao) {
        this.eventDao = eventDao;
    }

    /**
     * Le service peut vérifier les droits et modifier le RDV dans une seule transaction.
     */
    transaction(callback) {
        return this.eventDao.transaction(callback);
    }

    /**
     * Un calendrier absent donne null, un utilisateur absent du calendrier n'a pas de droit.
     */
    findCalendarAccess(calendarId, userId) {
        const row = this.eventDao.findCalendarAccess(calendarId, userId);

        if (!row) {
            return null;
        }

        return { id: row.id, name: row.name, permission: row.permission };
    }

    /**
     * Récupère un RDV lié à ce calendrier, ou null s'il n'y est pas.
     */
    findById(calendarId, eventId) {
        return toEvent(this.eventDao.findById(calendarId, eventId));
    }

    /**
     * Renvoie les calendriers du RDV avec le droit de l'utilisateur sur chacun.
     */
    findLinkedCalendarAccess(eventId, userId) {
        return this.eventDao.findLinkedCalendarAccess(eventId, userId).map((row) => ({
            calendarId: row.calendar_id,
            permission: row.permission
        }));
    }

    /**
     * Enregistre les champs du rendez-vous et renvoie l'objet créé avec son id.
     */
    create(calendarId, { start, duration, title, description = null, reminderTime = null }) {
        return toEvent(this.eventDao.create(calendarId, {
            start,
            duration,
            title,
            description,
            reminderTime
        }));
    }

    /**
     * Transmet les champs déjà validés par le service au DAO.
     */
    update(calendarId, eventId, { start, duration, title, description, reminderTime }) {
        return toEvent(this.eventDao.update(calendarId, eventId, {
            start,
            duration,
            title,
            description,
            reminderTime
        }));
    }

    /**
     * Renvoie true si le rendez-vous a bien été supprimé.
     */
    delete(calendarId, eventId) {
        return this.eventDao.delete(calendarId, eventId);
    }
}
