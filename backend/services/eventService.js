import { ApplicationError } from "../errors/applicationError.js";

const editableFields = new Set(["start", "duration", "title", "description", "reminderTime"]);
const writePermissions = new Set(["proprietaire", "editeur"]);

function invalidInput(message) {
    return new ApplicationError("INVALID_EVENT_INPUT", message);
}

// On refuse par exemple "12abc" : parseInt le transformerait quand même en 12.
function parseId(value) {
    if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) {
        throw invalidInput("L'identifiant doit être un entier positif.");
    }

    const id = typeof value === "string" ? Number(value) : value;
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw invalidInput("L'identifiant doit être un entier positif.");
    }
    return id;
}

// La date doit préciser son fuseau. On stocke ensuite tout en UTC pour les calendriers.
// On vérifie aussi les jours du mois : Date.parse accepte certaines dates comme le 30 février.
function normalizeStart(value) {
    const parts = typeof value === "string" && value.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/
    );
    if (!parts) {
        throw invalidInput("La date de début doit être une date ISO avec un fuseau (Z ou +02:00 par exemple).");
    }

    const [, yearText, monthText, dayText, hourText, minuteText, secondText, , timezone] = parts;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const invalidOffset = timezone !== "Z"
        && (Number(timezone.slice(1, 3)) > 23 || Number(timezone.slice(4, 6)) > 59);
    const timestamp = Date.parse(value);

    if (month < 1 || month > 12 || day < 1 || day > daysPerMonth[month - 1]
        || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText ?? 0) > 59
        || invalidOffset || !Number.isFinite(timestamp)) {
        throw invalidInput("La date de début est invalide.");
    }

    return new Date(timestamp).toISOString();
}

/**
 * Vérifie les champs envoyés et prépare les valeurs à enregistrer.
 * En modification, un champ absent doit rester inchangé ; null efface un champ facultatif.
 */
function validateData(data, partial = false) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw invalidInput("Les données du rendez-vous doivent être un objet.");
    }

    const fields = Object.keys(data);
    if (fields.some(field => !editableFields.has(field))) {
        throw invalidInput("Les données contiennent un champ de rendez-vous non reconnu.");
    }
    if (partial && fields.length === 0) {
        throw invalidInput("Il faut renseigner au moins un champ à modifier.");
    }

    const event = {};
    if (!partial || Object.hasOwn(data, "start")) {
        event.start = normalizeStart(data.start);
    }
    if (!partial || Object.hasOwn(data, "duration")) {
        if (!Number.isSafeInteger(data.duration) || data.duration <= 0) {
            throw invalidInput("La durée doit être un entier positif, en minutes.");
        }
        event.duration = data.duration;
    }
    if (!partial || Object.hasOwn(data, "title")) {
        if (typeof data.title !== "string" || !data.title.trim()) {
            throw invalidInput("Le titre du rendez-vous est obligatoire.");
        }
        event.title = data.title.trim();
    }
    if (Object.hasOwn(data, "description")) {
        if (data.description !== null && typeof data.description !== "string") {
            throw invalidInput("La description doit être un texte ou null.");
        }
        event.description = data.description;
    } else if (!partial) {
        event.description = null;
    }
    if (Object.hasOwn(data, "reminderTime")) {
        if (data.reminderTime !== null
            && (!Number.isSafeInteger(data.reminderTime) || data.reminderTime < 0)) {
            throw invalidInput("Le rappel doit être un entier positif ou nul, en minutes, ou null.");
        }
        event.reminderTime = data.reminderTime;
    } else if (!partial) {
        event.reminderTime = null;
    }

    return event;
}

export class EventService {
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }

    // L'identité vient du JWT vérifié, pas d'un userId que le client pourrait choisir.
    requireUser(userId) {
        if (typeof userId !== "string" || !userId) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }
    }

    // On utilise les labels des permissions : leurs identifiants peuvent changer selon la BDD.
    requireCalendarWrite(userId, calendarId) {
        const calendar = this.eventRepository.findCalendarAccess(calendarId, userId);
        if (!calendar) {
            throw new ApplicationError("CALENDAR_NOT_FOUND", "Calendrier introuvable.");
        }
        if (!writePermissions.has(calendar.permission)) {
            throw new ApplicationError("CALENDAR_ACCESS_DENIED", "Vous ne pouvez pas modifier ce calendrier.");
        }
    }

    // Un même rendez-vous peut apparaître dans plusieurs calendriers.
    // Avant de le changer pour tout le monde, on vérifie les droits sur chacun d'eux.
    requireEventWrite(userId, calendarId, eventId) {
        const event = this.eventRepository.findById(calendarId, eventId);
        if (!event) {
            throw new ApplicationError("EVENT_NOT_FOUND", "Rendez-vous introuvable dans ce calendrier.");
        }

        const calendars = this.eventRepository.findLinkedCalendarAccess(eventId, userId);
        if (calendars.some(calendar => !writePermissions.has(calendar.permission))) {
            throw new ApplicationError(
                "CALENDAR_ACCESS_DENIED",
                "Vous devez pouvoir modifier tous les calendriers liés à ce rendez-vous."
            );
        }
        return event;
    }

    /**
     * Crée un rendez-vous et le rattache au calendrier demandé.
     * Les droits et l'enregistrement sont vérifiés dans la même transaction.
     */
    create(userId, calendarId, data) {
        this.requireUser(userId);
        const id = parseId(calendarId);
        const event = validateData(data);

        return this.eventRepository.transaction(() => {
            this.requireCalendarWrite(userId, id);
            return this.eventRepository.create(id, event);
        });
    }

    // PATCH garde les champs déjà enregistrés quand ils ne sont pas envoyés dans le body.
    update(userId, calendarId, eventId, data) {
        this.requireUser(userId);
        const calendar = parseId(calendarId);
        const id = parseId(eventId);
        const changes = validateData(data, true);

        return this.eventRepository.transaction(() => {
            this.requireCalendarWrite(userId, calendar);
            const current = this.requireEventWrite(userId, calendar, id);
            return this.eventRepository.update(calendar, id, { ...current, ...changes });
        });
    }

    // On supprime le rendez-vous complet. SQLite enlève ses liens grâce aux clés étrangères.
    delete(userId, calendarId, eventId) {
        this.requireUser(userId);
        const calendar = parseId(calendarId);
        const id = parseId(eventId);

        return this.eventRepository.transaction(() => {
            this.requireCalendarWrite(userId, calendar);
            this.requireEventWrite(userId, calendar, id);
            return this.eventRepository.delete(calendar, id);
        });
    }
}
