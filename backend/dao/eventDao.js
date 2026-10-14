/**
 * Les requêtes SQL des rendez-vous et de leurs liens avec les calendriers.
 */
export class EventDAO {
    /**
     * @param {import("better-sqlite3").Database} database Base SQLite
     */
    constructor(database) {
        this.database = database;
    }

    /**
     * On regroupe les vérifications et l'écriture pour éviter qu'un droit change entre les deux.
     * Le callback doit rester synchrone, comme les requêtes better-sqlite3.
     */
    transaction(callback) {
        return this.database.transaction(callback).immediate();
    }

    /**
     * Renvoie le calendrier et le droit de cet utilisateur, même s'il n'est pas membre.
     */
    findCalendarAccess(calendarId, userId) {
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
     * On cherche le RDV dans le calendrier demandé, pas seulement par son id.
     */
    findById(calendarId, eventId) {
        return this.database.prepare(`
            SELECT event.id, event.start, event.duration, event.title,
                event.description, event.reminderTime, calendar2Event.calendar_id
            FROM event
            JOIN calendar2Event ON calendar2Event.event_id = event.id
            WHERE calendar2Event.calendar_id = ? AND event.id = ?
        `).get(calendarId, eventId);
    }

    /**
     * Un même RDV peut être partagé : on récupère les droits sur tous ses calendriers.
     */
    findLinkedCalendarAccess(eventId, userId) {
        return this.database.prepare(`
            SELECT calendar2Event.calendar_id, permissionType.label AS permission
            FROM calendar2Event
            LEFT JOIN calendarUser
                ON calendarUser.calendar_id = calendar2Event.calendar_id
                AND calendarUser.user_id = ?
            LEFT JOIN permissionType ON permissionType.id = calendarUser.permission_id
            WHERE calendar2Event.event_id = ?
            ORDER BY calendar2Event.calendar_id
        `).all(userId, eventId);
    }

    /**
     * On ajoute le RDV et son lien ensemble, pour ne pas laisser de RDV sans calendrier.
     */
    create(calendarId, { start, duration, title, description = null, reminderTime = null }) {
        return this.transaction(() => {
            const result = this.database.prepare(`
                INSERT INTO event (start, duration, title, description, reminderTime)
                VALUES (?, ?, ?, ?, ?)
            `).run(start, duration, title, description, reminderTime);

            this.database.prepare(`
                INSERT INTO calendar2Event (calendar_id, event_id) VALUES (?, ?)
            `).run(calendarId, result.lastInsertRowid);

            return this.findById(calendarId, result.lastInsertRowid);
        });
    }

    /**
     * Le service a déjà fusionné les champs : ici on écrit le RDV complet.
     */
    update(calendarId, eventId, { start, duration, title, description, reminderTime }) {
        this.database.prepare(`
            UPDATE event
            SET start = ?, duration = ?, title = ?, description = ?, reminderTime = ?
            WHERE id = ? AND EXISTS (
                SELECT 1 FROM calendar2Event
                WHERE calendar_id = ? AND event_id = event.id
            )
        `).run(start, duration, title, description, reminderTime, eventId, calendarId);

        return this.findById(calendarId, eventId);
    }

    /**
     * Supprime le RDV lui-même ; les liens sont supprimés par les clés étrangères.
     */
    delete(calendarId, eventId) {
        const result = this.database.prepare(`
            DELETE FROM event
            WHERE id = ? AND EXISTS (
                SELECT 1 FROM calendar2Event
                WHERE calendar_id = ? AND event_id = event.id
            )
        `).run(eventId, calendarId);

        return result.changes > 0;
    }
}
