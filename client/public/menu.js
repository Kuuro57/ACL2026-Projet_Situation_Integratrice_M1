const signedOutPanel = document.querySelector("#signed-out-panel");
const signedInPanel = document.querySelector("#signed-in-panel");
const navigation = document.querySelector("#menu-navigation");
const userLabel = document.querySelector("#menu-user");
const ownedCalendarList = document.querySelector("#owned-calendar-list");
const ownedCalendarsEmpty = document.querySelector("#owned-calendars-empty");
const sharedCalendarList = document.querySelector("#shared-calendar-list");
const sharedCalendarsEmpty = document.querySelector("#shared-calendars-empty");
const message = document.querySelector("#menu-message");
const errorMessage = document.querySelector("#menu-error");
const logoutButton = document.querySelector("#logout-button");

// Un agenda dont l'utilisateur est propriétaire va dans « Mes agendas », les autres dans « Agendas partagés »
const ownerPermission = "proprietaire";

function showSignedOut() {
  signedInPanel.hidden = true;
  signedOutPanel.hidden = false;
  navigation.hidden = true;
  userLabel.hidden = true;
  logoutButton.hidden = true;
}

function showSignedIn(user) {
  signedOutPanel.hidden = true;
  signedInPanel.hidden = false;
  navigation.hidden = false;
  userLabel.textContent = `Connecté en tant que ${user.username}`;
  userLabel.hidden = false;
  logoutButton.hidden = false;
}

function createCalendarItem(calendar) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "calendar-button";
  link.textContent = calendar.name;
  link.dataset.calendarId = calendar.id;
  link.href = `/calendarview/${calendar.id}`;
  item.append(link);
  return item;
}

// Remplit la liste d'une zone, ou affiche son message si elle est vide
function renderCalendarSection(list, emptyMessage, calendars) {
  list.replaceChildren(...calendars.map(createCalendarItem));
  list.hidden = calendars.length === 0;
  emptyMessage.hidden = calendars.length > 0;
}

async function loadCalendars() {
  const response = await fetch("/calendars", {
    headers: { Accept: "application/json" },
  });
  const calendars = await response.json();

  if (!response.ok) {
    throw new Error(calendars.error || "Impossible de charger les agendas.");
  }

  // Le serveur trie déjà par nom et filter garde cet ordre
  const ownedCalendars = calendars.filter((calendar) => calendar.permission === ownerPermission);
  const sharedCalendars = calendars.filter((calendar) => calendar.permission !== ownerPermission);

  message.textContent = "";
  renderCalendarSection(ownedCalendarList, ownedCalendarsEmpty, ownedCalendars);
  renderCalendarSection(sharedCalendarList, sharedCalendarsEmpty, sharedCalendars);
}

async function initializeMenu() {
  try {
    const response = await fetch("/users/me", {
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      showSignedOut();
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Impossible de vérifier la connexion.");
    }

    showSignedIn(data.user);
    await loadCalendars();
  } catch (error) {
    errorMessage.textContent = error.message || "Le serveur est inaccessible. Réessayez plus tard.";
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  errorMessage.textContent = "";

  try {
    const response = await fetch("/users/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error("La déconnexion a échoué.");
    }
    window.location.assign("/");
  } catch (error) {
    errorMessage.textContent = error.message || "Le serveur est inaccessible. Réessayez plus tard.";
    logoutButton.disabled = false;
  }
});

initializeMenu();
