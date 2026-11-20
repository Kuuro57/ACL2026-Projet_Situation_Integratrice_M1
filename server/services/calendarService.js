import { DateTime, IANAZone } from "luxon";
import { ApplicationError } from "../errors/applicationError.js";

const ownerPermission = "proprietaire";
const readPermissions = new Set([ownerPermission, "editeur", "visiteur"]);
const sharePermissions = new Set(["editeur", "visiteur"]);
const authorizedPeriods = {
    day: "day",
    week: "week",
    month: "month"
};

/**
 * Retourne la date de fin de la période donnée par rapport à la date donnée
 * @param {date} date 
 * @param {string} period 
 * @returns {date} La date de fin (du mois, de la semiane, de la journée...)
 */
function getEndOfPeriod(date, period) {
    let end;
    switch (period) {
        case authorizedPeriods.day:
            end = date.plus({ days: 1 });
            break;
    
        case authorizedPeriods.week:
            end = date.plus({ weeks: 1 });
            break;

        case authorizedPeriods.month:
            end = date.plus({ months: 1 });
            break;

        default:
            throw invalidInput("La période demandée est invalide.");
    }

    return end;
}

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
 * Vérifie les données d'un agenda (création ou renommage) et nettoie le nom
 * @param {*} data Données reçues dans le body
 * @returns {{ name: string }} Données validées, avec le nom sans espaces autour
 * @throws {ApplicationError} INVALID_CALENDAR_INPUT si le nom est absent, vide ou accompagné d'autres champs
 */
function parseCalendarData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)
        || Object.keys(data).some(key => key !== "name")
        || typeof data.name !== "string" || !data.name.trim()) {
        throw invalidInput("Il faut fournir un nom d'agenda non vide, dans le champ name.");
    }
    return { name: data.name.trim() };
}

/**
 * Calcule les bornes de la période demandée, de 00:00 à 00:00 (heure locale)
 * Luxon gère le fuseau et le changement d'heure
 * @param {{ date?: string, timeZone?: string, period: string }} query Paramètres de la requête
 * @returns {{ start: string, end: string, timeZone: string }}
 * Début (inclus) et fin (exclue) de la période en ISO UTC, avec le fuseau utilisé
 * @throws {ApplicationError} INVALID_CALENDAR_INPUT si un paramètre est inconnu,
 * ou si le fuseau ou la date est invalide
 */
function getPeriodBounds(query) {
    if (!query || typeof query !== "object" || Array.isArray(query)
        || Object.keys(query).some(key => !["date", "timeZone", "period"].includes(key))) {
        throw invalidInput("Les paramètres acceptés sont date, timeZone et period.");
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

    if (!Object.values(authorizedPeriods).includes(query.period)) {
        throw invalidInput("La période demandée est invalide.");
    }

    const start = date.startOf(query.period);

    // On reprend le début du jour si un changement d'heure a décalé le premier lundi
    let end = getEndOfPeriod(start, query.period).startOf("day");

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
        const calendar = parseCalendarData(data);

        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            return this.calendarRepository.create(userId, calendar);
        }, true);
    }

    /**
     * Renomme un agenda
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @param {string|number} calendarId Identifiant de l'agenda
     * @param {{ name: string }} data Nouveau nom de l'agenda
     * @returns {{ id: number, name: string, permission: string }} Agenda renommé avec le droit de l'utilisateur
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si personne n'est connecté ou si le compte n'existe plus,
     * INVALID_CALENDAR_INPUT si l'identifiant ou le nom est invalide, CALENDAR_NOT_FOUND si l'agenda n'existe pas,
     * CALENDAR_ACCESS_DENIED si l'utilisateur n'en est pas le propriétaire
     */
    rename(userId, calendarId, data) {
        this.requireUser(userId);
        const id = parseCalendarId(calendarId);
        const { name } = parseCalendarData(data);

        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            const calendar = this.calendarRepository.findAccess(id, userId);
            if (!calendar) {
                throw new ApplicationError("CALENDAR_NOT_FOUND", "Calendrier introuvable.");
            }
            if (calendar.permission !== ownerPermission) {
                throw new ApplicationError(
                    "CALENDAR_ACCESS_DENIED",
                    "Seul le propriétaire peut renommer ce calendrier."
                );
            }

            return this.calendarRepository.rename(id, userId, { name });
        }, true);
    }

    /**
     * Renvoie les calendriers dont l'utilisateur connecté est membre.
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @returns {{ id: number, name: string, permission: string }[]} Calendriers accessibles
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED si l'utilisateur est absent ou supprimé
     */
    listVisible(userId) {
        this.requireUser(userId);
        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            return this.calendarRepository.findVisibleByUser(userId);
        });
    }

    /**
     * Renvoie l'agenda, les bornes de la semaine et les rendez-vous qui la chevauchent
     * @param {string} userId Identifiant de l'utilisateur connecté
     * @param {string|number} calendarId Identifiant de l'agenda
     * @param {Object} [query={}] Période demandée
     * @param {string} [query.date] Un jour de la semaine au format YYYY-MM-DD (aujourd'hui par défaut)
     * @param {string} [query.timeZone] Fuseau IANA utilisé (Europe/Paris par défaut)
     * @param {string} [query.period] Période demandée (day, week, month)
     * @returns {{ calendar: { id: number, name: string, permission: string },
     * period: { start: string, end: string, timeZone: string }, events: Object[] }}
     * Agenda, bornes de la période et rendez-vous triés par date de début
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED, INVALID_CALENDAR_INPUT,
     * CALENDAR_NOT_FOUND si l'agenda n'existe pas ou CALENDAR_ACCESS_DENIED si l'utilisateur n'en est pas membre
     */
    get(userId, calendarId, query = {}) {
        this.requireUser(userId);
        const id = parseCalendarId(calendarId);
        const period = getPeriodBounds(query);

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
                period,
                events: this.calendarRepository.findEvents(id, period.start, period.end)
            };
        });
    }

    /**
     * Partage un agenda avec un autre utilisateur
     * Seul le propriétaire peut partager, et uniquement en editeur ou visiteur
     * @param {string} userId Identifiant de l'utilisateur connecté (propriétaire)
     * @param {string|number} calendarId Identifiant de l'agenda
     * @param {?string} newUserId Identifiant de l'utilisateur à ajouter (null s'il est introuvable)
     * @param {string} permission Droit donné au nouvel utilisateur (editeur ou visiteur)
     * @returns {{ id: number, name: string, permission: string }} Agenda avec le droit du nouvel utilisateur
     * @throws {ApplicationError} AUTHENTICATION_REQUIRED, INVALID_CALENDAR_INPUT si l'id ou la permission est invalide,
     * CALENDAR_NOT_FOUND, CALENDAR_ACCESS_DENIED si l'utilisateur connecté n'est pas propriétaire,
     * USER_NOT_FOUND si l'utilisateur à ajouter n'existe pas, USER_ALREADY_ADDED s'il est déjà membre
     */
    addUser(userId, calendarId, newUserId, permission) {
        this.requireUser(userId);
        const id = parseCalendarId(calendarId);
        if (!sharePermissions.has(permission)) {
            throw invalidInput("La permission doit être editeur ou visiteur.");
        }

        return this.calendarRepository.transaction(() => {
            this.requireExistingUser(userId);
            const calendar = this.calendarRepository.findAccess(id, userId);
            if (!calendar) {
                throw new ApplicationError("CALENDAR_NOT_FOUND", "Calendrier introuvable.");
            }
            if (calendar.permission !== ownerPermission) {
                throw new ApplicationError(
                    "CALENDAR_ACCESS_DENIED",
                    "Seul le propriétaire peut partager ce calendrier."
                );
            }
            if (!newUserId || !this.calendarRepository.userExists(newUserId)) {
                throw new ApplicationError("USER_NOT_FOUND", "Utilisateur introuvable.");
            }
            if (this.calendarRepository.findAccess(id, newUserId)?.permission != null) {
                throw new ApplicationError("USER_ALREADY_ADDED", "Cet utilisateur a déjà accès au calendrier.");
            }

            return this.calendarRepository.addUser(id, newUserId, permission);
        }, true);
    }
}
