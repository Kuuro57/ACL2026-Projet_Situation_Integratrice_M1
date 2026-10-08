const API_BASE_URL = "http://localhost:3000/api";

const loginForm = document.getElementById("login-form");
const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");
const appContainer = document.getElementById("app-container");
const currentUserSpan = document.getElementById("current-user-name");
const logoutButton = document.getElementById("logout-button");

function initAuth() {
  const token = localStorage.getItem("agenda_token");
  const username = localStorage.getItem("agenda_username");

  if (token && username) {
    toggleInterface(true, username);
  } else {
    toggleInterface(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  e;

  const usernameInput = document.getElementById("username").value;
  const passwordInput = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput,
      }),
    });

    if (response.ok) {
      const data = await response.json();

      localStorage.setItem("agenda_token", data.token);
      localStorage.setItem("agenda_username", data.username || usernameInput);

      toggleInterface(true, data.username || usernameInput);
    } else {
      const errorData = await response.json();
      alert(
        `Erreur de connexion : ${errorData.message || "Identifiants incorrects"}`,
      );
    }
  } catch (error) {
    console.error("Erreur réseau lors de la connexion :", error);
    alert(
      "Impossible de joindre le serveur. Vérifiez qu'il tourne bien sur le port 3000.",
    );
  }
});

logoutButton.addEventListener("click", async () => {
  localStorage.removeItem("agenda_token");
  localStorage.removeItem("agenda_username");
  loginForm.reset();

  toggleInterface(false);

  document.getElementById("agenda-list").innerHTML = "";
  document.getElementById("calendar-view").innerHTML = "";
});

function toggleInterface(isLoggedIn, username = "") {
  if (isLoggedIn) {
    loginSection.style.display = "none";
    userSection.style.display = "block";
    appContainer.style.display = "flex";
    currentUserSpan.textContent = `Connecté en tant que : ${username}`;
  } else {
    loginSection.style.display = "block";
    userSection.style.display = "none";
    appContainer.style.display = "none";
    currentUserSpan.textContent = "";
  }
}

initAuth();
