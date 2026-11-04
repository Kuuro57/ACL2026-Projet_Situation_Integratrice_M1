const SCROLL_TO_HOUR = 7;
const MONTH_EVENTS_SHOWN = 3;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const calendarId = document.querySelector("#calendar").dataset.calendarId;
const scrollArea = document.querySelector(".calendar-scroll");
const grid = document.querySelector("#calendar-grid");
const periodLabel = document.querySelector("#period-label");
const message = document.querySelector("#calendar-message");
const viewButtons = document.querySelectorAll("[data-view]");
const addButton = document.querySelector("#add-event");
const eventDialog = document.querySelector("#event-dialog");
const eventForm = document.querySelector("#event-form");
const eventFormMessage = document.querySelector("#event-form-message");
const eventDialogTitle = document.querySelector("#event-dialog-title");
const submitButton = document.querySelector("#event-submit");
const deleteButton = document.querySelector("#event-delete");

const weekdayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const rangeFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const errorMessages = {
    401: "Vous devez être connecté pour voir ce calendrier",
    403: "Vous n'avez pas accès à ce calendrier",
    404: "Ce calendrier n'existe pas"
};
const writePermissions = new Set(["proprietaire", "editeur"]);

let view = "week";
let current = startOfDay(new Date());
let lastRequest = 0;
let hasScrolled = false;
let canWrite = false;
let editedEvent = null;

function mondayOf(date) {
    const result = new Date(date);
    result.setDate(result.getDate() - (result.getDay() + 6) % 7);
    result.setHours(0, 0, 0, 0);
    return result;
}

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function firstOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Pas de toISOString ici : en UTC on tomberait sur la veille
function toDateParam(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function isSameDay(first, second) {
    return first.toDateString() === second.toDateString();
}

function eventEnd(event) {
    return new Date(new Date(event.start).getTime() + event.duration * 60 * 1000);
}

function eventsOfDay(events, day) {
    const nextDay = addDays(day, 1);
    return events.filter(event => new Date(event.start) < nextDay && eventEnd(event) > day);
}

function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function periodStart() {
    if (view === "day") return current;
    if (view === "week") return mondayOf(current);
    return firstOfMonth(current);
}

function periodTitle(start) {
    if (view === "day") return dayFormat.format(start);
    if (view === "week") return rangeFormat.formatRange(start, addDays(start, 6));
    return monthFormat.format(start);
}

function renderDayHeader(day, today) {
    const header = createElement("div", "day-header");
    header.classList.toggle("today", isSameDay(day, today));
    header.append(
        createElement("span", "day-name", weekdayFormat.format(day)),
        createElement("strong", "day-number", String(day.getDate()))
    );
    return header;
}

function renderHours() {
    const column = createElement("div", "hours-column");

    for (let hour = 0; hour < 24; hour += 2) {
        const label = createElement("span", "hour-label", `${String(hour).padStart(2, "0")} h`);
        label.style.top = `${hour / 24 * 100}%`;
        column.append(label);
    }

    return column;
}

// On garde seulement la partie du rdv qui tombe dans ce jour
function renderEvent(event, dayStart, dayEnd) {
    const start = new Date(event.start);
    const end = new Date(start.getTime() + event.duration * 60 * 1000);
    const from = Math.max(start, dayStart);
    const to = Math.min(end, dayEnd);

    if (to <= from) {
        return null;
    }

    const block = createElement("article", "event");
    block.style.top = `${(from - dayStart) / (dayEnd - dayStart) * 100}%`;
    block.style.height = `${(to - from) / (dayEnd - dayStart) * 100}%`;
    block.title = event.description ? `${event.title}\n${event.description}` : event.title;
    block.append(
        createElement("strong", "event-title", event.title),
        createElement("span", "event-time", `${timeFormat.format(start)} – ${timeFormat.format(end)}`)
    );

    if (canWrite) {
        block.tabIndex = 0;
        block.classList.add("editable");
        block.addEventListener("click", () => openEventDialog(event));
        block.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key === "Enter") openEventDialog(event);
        });
    }
    return block;
}

// Vue jour (1 colonne) et vue semaine (7 colonnes)
function renderTimeGrid(days, events) {
    const today = new Date();

    grid.className = "time-grid";
    grid.style.setProperty("--days", days.length);
    grid.replaceChildren(createElement("div", "corner"));

    for (const day of days) {
        grid.append(renderDayHeader(day, today));
    }

    grid.append(renderHours());

    const columns = days.map((day) => {
        const column = createElement("div", "day-column");
        column.classList.toggle("today", isSameDay(day, today));
        grid.append(column);
        return column;
    });

    days.forEach((day, index) => {
        const nextDay = addDays(day, 1);
        for (const event of events) {
            const block = renderEvent(event, day, nextDay);
            if (block) columns[index].append(block);
        }
    });

    // On descend à 7h au premier affichage de la grille (et en revenant de la vue mois)
    if (!hasScrolled) {
        const hourHeight = columns[0].offsetHeight / 24;
        scrollArea.scrollTop = SCROLL_TO_HOUR * hourHeight;
        hasScrolled = true;
    }
}

function renderMonthEvent(event, day) {
    const start = new Date(event.start);
    const item = createElement("span", "month-event");
    item.textContent = `${start < day ? "(suite)" : timeFormat.format(start)} ${event.title}`;
    item.title = event.description ? `${event.title}\n${event.description}` : event.title;

    if (canWrite) {
        item.classList.add("editable");
        item.addEventListener("click", (clickEvent) => {
            // Sinon le clic ouvre aussi la vue jour de la case
            clickEvent.stopPropagation();
            openEventDialog(event);
        });
    }
    return item;
}

// Les jours du mois précédent/suivant complètent les semaines, en grisé
function renderMonth(firstDay, events) {
    const today = new Date();
    const gridStart = mondayOf(firstDay);
    const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1);
    const weeks = Math.ceil((addDays(nextMonth, -1).getDate() + (firstDay.getDay() + 6) % 7) / 7);

    grid.className = "month-grid";
    grid.style.removeProperty("--days");
    grid.replaceChildren();

    for (let index = 0; index < 7; index++) {
        grid.append(createElement("div", "month-weekday", weekdayFormat.format(addDays(gridStart, index))));
    }

    for (let index = 0; index < weeks * 7; index++) {
        const day = addDays(gridStart, index);
        const inMonth = day.getMonth() === firstDay.getMonth();
        const cell = createElement("button", "month-day");
        cell.type = "button";
        cell.classList.toggle("outside", !inMonth);
        cell.classList.toggle("today", isSameDay(day, today));
        cell.setAttribute("aria-label", dayFormat.format(day));
        cell.append(createElement("span", "month-day-number", String(day.getDate())));

        const dayEvents = eventsOfDay(events, day);
        for (const event of dayEvents.slice(0, MONTH_EVENTS_SHOWN)) {
            cell.append(renderMonthEvent(event, day));
        }
        if (dayEvents.length > MONTH_EVENTS_SHOWN) {
            cell.append(createElement("span", "month-more", `+ ${dayEvents.length - MONTH_EVENTS_SHOWN} autre(s)`));
        }

        cell.addEventListener("click", () => {
            current = day;
            setView("day");
        });
        grid.append(cell);
    }

    scrollArea.scrollTop = 0;
    hasScrolled = false;
}

function render(start, events) {
    if (view === "month") {
        renderMonth(start, events);
    } else {
        const length = view === "day" ? 1 : 7;
        renderTimeGrid(Array.from({ length }, (_, index) => addDays(start, index)), events);
    }
}

async function fetchPeriod(period, date) {
    const params = new URLSearchParams({ date: toDateParam(date), timeZone });
    const response = await fetch(`/calendars/${encodeURIComponent(calendarId)}/${period}?${params}`, {
        headers: { "Accept": "application/json" }
    });
    return { response, data: await response.json() };
}

// La grille déborde sur les mois voisins, on demande aussi ses semaines de début et de fin
function monthRequests(firstDay) {
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
    const requests = [fetchPeriod("month", firstDay)];
    if (firstDay.getDay() !== 1) requests.push(fetchPeriod("week", firstDay));
    if (lastDay.getDay() !== 0) requests.push(fetchPeriod("week", lastDay));
    return requests;
}

// Un rdv peut revenir dans plusieurs réponses (le mois et une semaine)
function mergeEvents(results) {
    const events = new Map();
    for (const { data } of results) {
        for (const event of data.events) events.set(event.id, event);
    }
    return [...events.values()].sort((a, b) => new Date(a.start) - new Date(b.start));
}

function setCanWrite(value) {
    canWrite = value;
    addButton.hidden = !value;
}

async function loadPeriod() {
    const request = ++lastRequest;
    const start = periodStart();
    periodLabel.textContent = periodTitle(start);
    showMessage("");

    try {
        const results = await Promise.all(view === "month" ? monthRequests(start) : [fetchPeriod(view, start)]);

        // Réponse d'une période qu'on a déjà quittée
        if (request !== lastRequest) return;

        const failed = results.find(({ response }) => !response.ok);
        if (failed) {
            setCanWrite(false);
            render(start, []);
            showMessage(errorMessages[failed.response.status] || failed.data.error || "Impossible de charger le calendrier");
            return;
        }

        setCanWrite(writePermissions.has(results[0].data.calendar.permission));
        render(start, mergeEvents(results));
    } catch (error) {
        console.error(error);
        if (request !== lastRequest) return;
        setCanWrite(false);
        render(start, []);
        showMessage("Le serveur est inaccessible, réessayez plus tard");
    }
}

function setView(nextView) {
    view = nextView;
    for (const button of viewButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.view === view));
    }
    loadPeriod();
}

// Format attendu par un input datetime-local : AAAA-MM-JJTHH:MM, en heure locale
function toInputValue(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${toDateParam(date)}T${hours}:${minutes}`;
}

// new Date(année, mois, jour, h, min) garde l'heure saisie comme une heure locale
function fromInputValue(value) {
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes);
}

function openEventDialog(event = null) {
    editedEvent = event;
    eventForm.reset();
    eventFormMessage.textContent = "";
    eventDialogTitle.textContent = event ? "Modifier le rendez-vous" : "Nouveau rendez-vous";
    submitButton.textContent = event ? "Enregistrer" : "Ajouter";
    deleteButton.hidden = !event;

    const fields = eventForm.elements;
    if (event) {
        fields.title.value = event.title;
        fields.start.value = toInputValue(new Date(event.start));
        fields.end.value = toInputValue(eventEnd(event));
        fields.description.value = event.description ?? "";
        // Un rappel absent de la liste serait effacé en enregistrant
        if (event.reminderTime !== null && !fields.reminderTime.querySelector(`option[value="${event.reminderTime}"]`)) {
            fields.reminderTime.add(new Option(`${event.reminderTime} minutes avant`, event.reminderTime));
        }
        fields.reminderTime.value = event.reminderTime ?? "";
    } else {
        const start = new Date(current);
        start.setHours(9, 0, 0, 0);
        fields.start.value = toInputValue(start);
        fields.end.value = toInputValue(new Date(start.getTime() + 60 * 60 * 1000));
    }

    eventDialog.showModal();
    fields.title.focus();
}

// Si on décale le début après la fin, la fin suit avec une heure d'écart
function keepEndAfterStart() {
    const fields = eventForm.elements;
    if (!fields.start.value || !fields.end.value) return;

    const start = fromInputValue(fields.start.value);
    if (fromInputValue(fields.end.value) <= start) {
        fields.end.value = toInputValue(new Date(start.getTime() + 60 * 60 * 1000));
    }
}

async function submitEvent(submit) {
    submit.preventDefault();
    const form = new FormData(eventForm);
    const title = form.get("title").trim();
    eventFormMessage.textContent = "";

    if (!title || !form.get("start") || !form.get("end")) {
        eventFormMessage.textContent = "Le titre, le début et la fin sont obligatoires";
        return;
    }

    const start = fromInputValue(form.get("start"));
    const end = fromInputValue(form.get("end"));
    if (end <= start) {
        eventFormMessage.textContent = "La fin doit être après le début";
        return;
    }

    const url = editedEvent
        ? `/calendars/${encodeURIComponent(calendarId)}/events/${editedEvent.id}`
        : `/calendars/${encodeURIComponent(calendarId)}/events`;

    submitButton.disabled = true;
    try {
        const response = await fetch(url, {
            method: editedEvent ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                start: start.toISOString(),
                duration: (end - start) / 60000,
                title,
                description: form.get("description").trim() || null,
                reminderTime: form.get("reminderTime") ? Number(form.get("reminderTime")) : null
            })
        });
        const data = await response.json();

        if (!response.ok) {
            eventFormMessage.textContent = data.error || "Le rendez-vous n'a pas pu être enregistré";
            return;
        }

        eventDialog.close();
        current = startOfDay(start);
        loadPeriod();
    } catch (error) {
        console.error(error);
        eventFormMessage.textContent = "Le serveur est inaccessible, réessayez plus tard";
    } finally {
        submitButton.disabled = false;
    }
}

async function deleteEvent() {
    if (!confirm(`Supprimer « ${editedEvent.title} » ?`)) return;

    deleteButton.disabled = true;
    try {
        const response = await fetch(`/calendars/${encodeURIComponent(calendarId)}/events/${editedEvent.id}`, {
            method: "DELETE",
            headers: { "Accept": "application/json" }
        });

        // 204 : pas de corps à lire
        if (!response.ok) {
            const data = await response.json();
            eventFormMessage.textContent = data.error || "Le rendez-vous n'a pas pu être supprimé";
            return;
        }

        eventDialog.close();
        loadPeriod();
    } catch (error) {
        console.error(error);
        eventFormMessage.textContent = "Le serveur est inaccessible, réessayez plus tard";
    } finally {
        deleteButton.disabled = false;
    }
}

function move(step) {
    if (view === "day") current = addDays(current, step);
    if (view === "week") current = addDays(current, 7 * step);
    if (view === "month") current = new Date(current.getFullYear(), current.getMonth() + step, 1);
    loadPeriod();
}

for (const button of viewButtons) {
    button.addEventListener("click", () => setView(button.dataset.view));
}

addButton.addEventListener("click", () => openEventDialog());
eventForm.addEventListener("submit", submitEvent);
eventForm.elements.start.addEventListener("change", keepEndAfterStart);
deleteButton.addEventListener("click", deleteEvent);
document.querySelector("#event-cancel").addEventListener("click", () => eventDialog.close());

document.querySelector("#previous-period").addEventListener("click", () => move(-1));
document.querySelector("#next-period").addEventListener("click", () => move(1));

document.querySelector("#current-period").addEventListener("click", () => {
    current = startOfDay(new Date());
    loadPeriod();
});

loadPeriod();