const signedOutPanel = document.querySelector("#signed-out-panel");
const signedInPanel = document.querySelector("#signed-in-panel");
const navigation = document.querySelector("#menu-navigation");
const userLabel = document.querySelector("#menu-user");
const calendarList = document.querySelector("#calendar-list");
const message = document.querySelector("#menu-message");
const errorMessage = document.querySelector("#menu-error");
const logoutButton = document.querySelector("#logout-button");

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

async function loadCalendars() {
  const response = await fetch("/calendars", {
    headers: { Accept: "application/json" },
  });
  const calendars = await response.json();

  if (!response.ok) {
    throw new Error(calendars.error || "Impossible de charger les agendas.");
  }

  calendarList.replaceChildren();
  if (calendars.length === 0) {
    message.textContent = "Aucun agenda accessible pour le moment.";
    return;
  }

  message.textContent = "";
  for (const calendar of calendars) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-button";
    button.textContent = calendar.name;
    button.dataset.calendarId = calendar.id;
    button.addEventListener("click", () => {
      message.textContent = "La page de visualisation de cet agenda n’est pas encore disponible.";
    });
    item.append(button);
    calendarList.append(item);
  }
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
