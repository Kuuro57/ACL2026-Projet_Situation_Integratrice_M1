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
        const result = await loginAndRedirect(username, password);
        if (result && !result.ok) {
            showMessage(result.error || "La connexion a échoué");
        }
    } catch (error) {
        console.error(error);
        showMessage("Le serveur est inaccessible, réessayez plus tard");
    } finally {
        submitButton.disabled = false;
    }
});
