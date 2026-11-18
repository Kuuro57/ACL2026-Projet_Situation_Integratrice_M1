const form = document.querySelector("#creation-compte-form");
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
    const email = formData.get("email").trim();
    const password = formData.get("password");
    const passwordConfirmation = formData.get("passwordConfirmation");

    if (!username || !password || !passwordConfirmation) {
        showMessage("Le nom d'utilisateur et les deux mots de passe sont requis");
        submitButton.disabled = false;
        return;
    }

    if (password !== passwordConfirmation) {
        showMessage("Les mots de passe ne correspondent pas");
        submitButton.disabled = false;
        return;
    }

    try {
        const response = await fetch("/users/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                username,
                email: email || null,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || "La création du compte a échoué");
            return;
        }

        form.reset();
        showMessage(`Compte créé pour ${data.username}.`, false);
    } catch (error) {
        console.error(error);
        showMessage("Le serveur est inaccessible réessayez plus tard");
    } finally {
        submitButton.disabled = false;
    }
});