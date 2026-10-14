import { DateTime, IANAZone } from "luxon";
import { ApplicationError } from "../errors/applicationError.js";

const readPermissions = new Set(["proprietaire", "editeur", "visiteur"]);

/**
 * Crée l'erreur renvoyée quand une donnée reçue est invalide
 * @param {string} message Message renvoyé au client
 * @returns {ApplicationError} Erreur INVALID_CALENDAR_INPUT
 */
function invalidInput(message) {
    return new ApplicationError("INVALID_CALENDAR_INPUT", message);
}

/**
 * Convertit l'identifiant du calendrier en entier strictement positif
 * On refuse par exemple "12abc", que parseInt transformerait quand même en 12
 * @param {string|number} value Identifiant reçu (paramètre de route ou nombre)
 * @returns {number} Identifiant converti
 * @throws {ApplicationError} INVALID_CALENDAR_INPUT si l'identifiant n'est pas un entier positif
 */
function parseCalendarId(value) {
    if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) {
        throw invalidInput("L'identifiant du calendrier doit être un entier positif.");
    }
    const id = typeof value === "string" ? Number(value) : value;
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw invalidInput("L'identifiant du calendrier doit être un entier positif.");
    }
    return id;
}

/**
 * Calcule les bornes de la semaine demandée, du lundi 00:00 au lundi suivant 00:00 à l'heure locale
 * Luxon gère le fuseau et le changement d'heure : une semaine n'a pas toujours 168 heures
 * @param {{ date?: string, timeZone?: string }} query Paramètres de la requête
 * @returns {{ start: string, end: string, timeZone: string }}
 * Début (inclus) et fin (exclue) de la semaine en ISO UTC, avec le fuseau utilisé
 * @throws {ApplicationError} INVALID_CALENDAR_INPUT si un paramètre est inconnu,
 * ou si le fuseau ou la date est invalide
 */
function getWeekBounds(query) {
    if (!query || typeof query !== "object" || Array.isArray(query)
        || Object.keys(query).some(key => !["date", "timeZone"].includes(key))) {
        throw invalidInput("Les paramètres acceptés sont date et timeZone.");
    }

    const timeZone = query.timeZone === undefined ? "Europe/Paris" : query.timeZone;
    if (typeof timeZone !== "string" || !IANAZone.isValidZone(timeZone)) {
        throw invalidInput("Le fuseau horaire est invalide (Europe/Paris par exemple).");
    }
    if (query.date !== undefined
        && (typeof query.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(query.date))) {
        throw invalidInput("La date doit être au format YYYY-MM-DD.");
    }

    const date = query.date === undefined
        ? DateTime.now().setZone(timeZone)
        : DateTime.fromISO(query.date, { zone: timeZone });
    if (!date.isValid) {
        throw invalidInput("La date demandée est invalide.");
    }

    const start = date.startOf("week");

    // On reprend le début du jour si un changement d'heure a décalé le premier lundi
    const end = start.plus({ weeks: 1 }).startOf("day");
    return { start: start.toUTC().toISO(), end: end.toUTC().toISO(), timeZone };
}





/**
 * Logique métier des calendriers
 */
export class CalendarService {
    /**
     * @param {import("../repositories/calendarRepository.js").CalendarRepository} calendarRepository Repository des calendriers
     */
    constructor(calendarRepository) {
        this.calendarRepository = calendarRepository;
    }

    /**
     * Vérifie qu'un utilisateur est connecté
     * @param {?string} userId Identifiant de l'utilisateur connecté
     * @returns {void}
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si l'identifiant est absent
     */
    requireUser(userId) {
        if (typeof userId !== "string" || !userId) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Authentification requise.");
        }
    }

    /**
     * Vérifie que le compte connecté existe encore
     * Un ancien token peut encore exister après la suppression du compte
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @returns {void}
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si le compte n'existe plus
     */
    requireExistingUser(userId) {
        if (!this.calendarRepository.userExists(userId)) {
            throw new ApplicationError("AUTHENTICATION_REQUIRED", "Le compte connecté n'existe plus.");
        }
    }

    /**
     * Crée l'agenda et ajoute son créateur comme propriétaire
     * Si l'ajout du propriétaire échoue, on ne laisse pas un agenda sans membre
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @param {{ name: string }} data Données de l'agenda
     * @returns {{ id: number, name: string, permission: string }} Agenda créé avec le droit du créateur
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si personne n'est connecté ou si le compte n'existe plus,
     * INVALID_CALENDAR_INPUT si le nom est absent, vide ou accompagné d'autres champs
     */
    create(userId, data) {
        this.requireUser(userId);
        if (!data || typeof data !== "object" || Array.isArray(data)
            || Object.keys(data).some(key => key !== "name")
            || typeof data.name !== "string" || !data.name.trim()) {
            throw invalidInput("Il faut fournir un nom d'agenda non vide, dans le champ name.");
        }

        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            return this.calendarRepository.create(userId, { name: data.name.trim() });
        }, true);
    }

    /**
     * Renvoie l'agenda, les bornes de la semaine et les rendez-vous qui la chevauchent
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @param {string|number} calendarId Identifiant de l'agenda
     * @param {Object} [query={}] Semaine demandée
     * @param {string} [query.date] Un jour de la semaine au format YYYY-MM-DD (aujourd'hui par défaut)
     * @param {string} [query.timeZone] Fuseau IANA utilisé pour découper la semaine (Europe/Paris par défaut)
     * @returns {{ calendar: { id: number, name: string, permission: string },
     * week: { start: string, end: string, timeZone: string }, events: Object[] }}
     * Agenda, bornes de la semaine et rendez-vous triés par date de début
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED, INVALID_CALENDAR_INPUT,
     * CALENDAR_NOT_FOUND si l'agenda n'existe pas ou CALENDAR_ACCESS_DENIED si l'utilisateur n'en est pas membre
     */
    getWeek(userId, calendarId, query = {}) {
        this.requireUser(userId);
        const id = parseCalendarId(calendarId);
        const week = getWeekBounds(query);

        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            const calendar = this.calendarRepository.findAccess(id, userId);
            if (!calendar) {
                throw new ApplicationError("CALENDAR_NOT_FOUND", "Calendrier introuvable.");
            }
            if (!readPermissions.has(calendar.permission)) {
                throw new ApplicationError("CALENDAR_ACCESS_DENIED", "Vous ne pouvez pas consulter ce calendrier.");
            }

            return {
                calendar,
                week,
                events: this.calendarRepository.findEvents(id, week.start, week.end)
            };
        });
    }
}
