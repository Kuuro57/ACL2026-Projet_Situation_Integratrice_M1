const form = document.querySelector("#creation-agenda-form");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector('button[type="submit"]');

function showMessage(text, isError = true) {
  message.textContent = text;
  message.dataset.type = isError ? "error" : "success";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  submitButton.disabled = true;

  const name = new FormData(form).get("name").trim();
  if (!name) {
    showMessage("Le nom de l’agenda est requis.");
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch("/calendars", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || "La création de l’agenda a échoué.");
      return;
    }

    form.reset();
    showMessage(`Agenda « ${data.name} » créé.`, false);
  } catch (error) {
    console.error(error);
    showMessage("Le serveur est inaccessible. Réessayez plus tard.");
  } finally {
    submitButton.disabled = false;
  }
});
