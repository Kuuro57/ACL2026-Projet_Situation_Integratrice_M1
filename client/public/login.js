const form = document.querySelector("#login-form");
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

    const formData = new FormData(form);
    const username = formData.get("username").trim();
    const password = formData.get("password");

    if (!username || !password) {
        showMessage("Le nom d'utilisateur et le mot de passe sont requis");
        submitButton.disabled = false;
        return;
    }

    try {
        const response = await fetch("/users/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || "La connexion a échoué");
            return;
        }

        const sessionResponse = await fetch("/users/me", {
            headers: { "Accept": "application/json" },
            credentials: "same-origin"
        });
        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
            showMessage(sessionData.error || "La session n’a pas pu être vérifiée. Réessayez.");
            return;
        }

        window.location.assign("/");
    } catch (error) {
        console.error(error);
        showMessage("Le serveur est inaccessible, réessayez plus tard");
    } finally {
        submitButton.disabled = false;
    }
});
