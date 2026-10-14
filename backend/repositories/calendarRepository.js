/**
 * Convertit une ligne du DAO en calendrier
 * @param {{ id: number, name: string, permission: ?string } | undefined} row Ligne renvoyée par le DAO
 * @returns {?{ id: number, name: string, permission: ?string }} Calendrier, ou null si la ligne est absente
 */
function toCalendar(row) {
    if (!row) {
        return null;
    }

    return { id: row.id, name: row.name, permission: row.permission };
}

/**
 * Convertit une ligne du DAO en rendez-vous, avec les mêmes champs que dans eventRepository
 * @param {{ id: number, start: string, duration: number, title: string, description: ?string,
 * reminderTime: ?number, calendar_id: number }} row Ligne renvoyée par le DAO
 * @returns {{ id: number, calendarId: number, start: string, duration: number, title: string,
 * description: ?string, reminderTime: ?number }} Rendez-vous
 */
function toEvent(row) {
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
 * Fait le lien entre les lignes du DAO et les objets utilisés par le service
 */
export class CalendarRepository {
    
    /**
     * @param {import("../dao/calendarDao.js").CalendarDAO} calendarDao DAO des calendriers
     */
    constructor(calendarDao) {
        this.calendarDao = calendarDao;
    }

    /**
     * Permet au service de faire ses vérifications et ses requêtes dans une seule transaction
     * @param {Function} callback Fonction synchrone à exécuter dans la transaction
     * @param {boolean} [immediate=false] true pour prendre le verrou d'écriture dès le début
     * @returns {*} Valeur renvoyée par le callback
     */
    transaction(callback, immediate = false) {
        return this.calendarDao.transaction(callback, immediate);
    }

    /**
     * Vérifie que l'utilisateur existe encore
     * @param {string} userId Identifiant de l'utilisateur
     * @returns {boolean} true si l'utilisateur existe
     */
    userExists(userId) {
        return this.calendarDao.userExists(userId);
    }

    /**
     * Récupère un calendrier avec le droit de l'utilisateur dessus
     * @param {number} calendarId Identifiant du calendrier
     * @param {string} userId Identifiant de l'utilisateur
     * @returns {?{ id: number, name: string, permission: ?string }} Calendrier trouvé, ou null
     */
    findAccess(calendarId, userId) {
        return toCalendar(this.calendarDao.findAccess(calendarId, userId));
    }

    /**
     * Récupère les rendez-vous du calendrier qui chevauchent la période
     * @param {number} calendarId Identifiant du calendrier
     * @param {string} start Début de la période (inclus), en ISO UTC
     * @param {string} end Fin de la période (exclue), en ISO UTC
     * @returns {{ id: number, calendarId: number, start: string, duration: number, title: string,
     * description: ?string, reminderTime: ?number }[]} Rendez-vous triés par date de début
     */
    findEvents(calendarId, start, end) {
        return this.calendarDao.findEvents(calendarId, start, end).map(toEvent);
    }

    /**
     * Enregistre un calendrier dont l'utilisateur devient le propriétaire
     * @param {string} userId Identifiant du créateur
     * @param {Object} calendar Calendrier à enregistrer
     * @param {string} calendar.name Nom du calendrier
     * @returns {{ id: number, name: string, permission: string }} Calendrier créé avec son id
     */
    create(userId, { name }) {
        return toCalendar(this.calendarDao.create(name, userId, "proprietaire"));
    }
}
