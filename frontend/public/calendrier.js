const SCROLL_TO_HOUR = 7;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const calendarId = document.querySelector("#calendar").dataset.calendarId;
const scrollArea = document.querySelector(".week-scroll");
const grid = document.querySelector("#week-grid");
const weekLabel = document.querySelector("#week-label");
const message = document.querySelector("#calendar-message");

const weekdayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const rangeFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const errorMessages = {
    401: "Vous devez être connecté pour voir ce calendrier",
    403: "Vous n'avez pas accès à ce calendrier",
    404: "Ce calendrier n'existe pas"
};

let monday = mondayOf(new Date());
let lastRequest = 0;
let hasScrolled = false;

function mondayOf(date) {
    const result = new Date(date);
    result.setDate(result.getDate() - (result.getDay() + 6) % 7);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Pas de toISOString ici : en UTC on tomberait sur le dimanche
function toDateParam(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function isSameDay(first, second) {
    return first.toDateString() === second.toDateString();
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
    return block;
}

function renderWeek(events) {
    const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
    const today = new Date();

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

    // On descend à 7h seulement au premier chargement
    if (!hasScrolled) {
        const hourHeight = columns[0].offsetHeight / 24;
        scrollArea.scrollTop = SCROLL_TO_HOUR * hourHeight;
        hasScrolled = true;
    }
}

async function loadWeek() {
    const request = ++lastRequest;
    weekLabel.textContent = rangeFormat.formatRange(monday, addDays(monday, 6));
    showMessage("");

    try {
        const params = new URLSearchParams({ date: toDateParam(monday), timeZone });
        const response = await fetch(`/calendars/${encodeURIComponent(calendarId)}/week?${params}`, {
            headers: { "Accept": "application/json" }
        });
        const data = await response.json();

        // Réponse d'une semaine qu'on a déjà quittée
        if (request !== lastRequest) return;

        if (!response.ok) {
            renderWeek([]);
            showMessage(errorMessages[response.status] || data.error || "Impossible de charger le calendrier");
            return;
        }

        renderWeek(data.events);
    } catch (error) {
        console.error(error);
        if (request !== lastRequest) return;
        renderWeek([]);
        showMessage("Le serveur est inaccessible, réessayez plus tard");
    }
}

document.querySelector("#previous-week").addEventListener("click", () => {
    monday = addDays(monday, -7);
    loadWeek();
});

document.querySelector("#next-week").addEventListener("click", () => {
    monday = addDays(monday, 7);
    loadWeek();
});

document.querySelector("#current-week").addEventListener("click", () => {
    monday = mondayOf(new Date());
    loadWeek();
});

loadWeek();