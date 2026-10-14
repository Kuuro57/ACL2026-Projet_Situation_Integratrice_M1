/**
 * Les requêtes SQL des calendriers et de leurs membres.
 */
export class CalendarDAO {
    
    /**
     * @param {import("better-sqlite3").Database} database Base SQLite
     */
    constructor(database) {
        this.database = database;
    }

    /**
     * Exécute le callback dans une transaction.
     * Le callback doit rester synchrone, comme les requêtes better-sqlite3.
     * @param {Function} callback Fonction à exécuter dans la transaction
     * @param {boolean} [immediate=false] true pour prendre le verrou d'écriture dès le début
     * @returns {*} Valeur renvoyée par le callback
     */
    transaction(callback, immediate = false) {
        const transaction = this.database.transaction(callback);
        return immediate ? transaction.immediate() : transaction();
    }

    /**
     * Vérifie que l'utilisateur existe encore dans la table user
     * @param {string} userId Identifiant de l'utilisateur
     * @returns {boolean} true si l'utilisateur existe
     */
    userExists(userId) {
        return this.database.prepare("SELECT 1 FROM user WHERE id = ?").get(userId) !== undefined;
    }

    /**
     * Renvoie le calendrier et le droit de cet utilisateur
     * @param {number} calendarId Identifiant du calendrier
     * @param {string} userId Identifiant de l'utilisateur
     * @returns {{ id: number, name: string, permission: ?string } | undefined}
     * La ligne trouvée (permission vaut null si l'utilisateur n'est pas membre), ou undefined
     */
    findAccess(calendarId, userId) {
        return this.database.prepare(`
            SELECT calendar.id, calendar.name, permissionType.label AS permission
            FROM calendar
            LEFT JOIN calendarUser
                ON calendarUser.calendar_id = calendar.id AND calendarUser.user_id = ?
            LEFT JOIN permissionType ON permissionType.id = calendarUser.permission_id
            WHERE calendar.id = ?
        `).get(userId, calendarId);
    }

    /**
     * Récupère les rendez-vous du calendrier qui chevauchent la période [start, end[.
     * Les dates sont toutes au format ISO UTC avec millisecondes, on peut donc les comparer comme du texte.
     * @param {number} calendarId Identifiant du calendrier
     * @param {string} start Début de la période (inclus), en ISO UTC
     * @param {string} end Fin de la période (exclue), en ISO UTC
     * @returns {{ id: number, start: string, duration: number, title: string, description: ?string,
     * reminderTime: ?number, calendar_id: number }[]} Les lignes trouvées, triées par date de début
     */
    findEvents(calendarId, start, end) {
        return this.database.prepare(`
            SELECT event.id, event.start, event.duration, event.title,
                event.description, event.reminderTime, calendar2Event.calendar_id
            FROM event
            JOIN calendar2Event ON calendar2Event.event_id = event.id
            WHERE calendar2Event.calendar_id = ?
                AND event.start < ?
                AND strftime('%Y-%m-%dT%H:%M:%fZ', event.start, '+' || event.duration || ' minutes') > ?
            ORDER BY event.start, event.id
        `).all(calendarId, end, start);
    }

    /**
     * Ajoute le calendrier et son premier membre ensemble
     * @param {string} name Nom du calendrier
     * @param {string} userId Identifiant de l'utilisateur à rattacher
     * @param {string} permission Label de la permission donnée à cet utilisateur
     * @returns {{ id: number, name: string, permission: string }} Le calendrier créé avec le droit de l'utilisateur
     * @throws {Error} Si la permission n'existe pas dans permissionType
     */
    create(name, userId, permission) {
        return this.database.transaction(() => {
            const result = this.database.prepare(
                "INSERT INTO calendar (name) VALUES (?)"
            ).run(name);

            const link = this.database.prepare(`
                INSERT INTO calendarUser (calendar_id, user_id, permission_id)
                SELECT ?, ?, id FROM permissionType WHERE label = ?
            `).run(result.lastInsertRowid, userId, permission);

            // Sans cette vérification, une permission absente donnerait un calendrier sans membre.
            if (link.changes === 0) {
                throw new Error(`La permission ${permission} est absente de la table permissionType.`);
            }

            return this.findAccess(result.lastInsertRowid, userId);
        })();
    }
}
