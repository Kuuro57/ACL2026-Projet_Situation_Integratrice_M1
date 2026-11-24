/**
 * Connecte l'utilisateur, vérifie la session puis redirige vers l'accueil.
 * @param {string} username Nom d'utilisateur
 * @param {string} password Mot de passe
 * @returns {Promise<{ ok: false, error: string | null }>} Uniquement en cas d'échec (sinon la page est redirigée)
 */
async function loginAndRedirect(username, password) {
    const loginResponse = await fetch("/users/login", {
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
    const loginData = await loginResponse.json().catch(() => ({}));

    if (!loginResponse.ok) {
        return { ok: false, error: loginData.error || null };
    }

    const sessionResponse = await fetch("/users/me", {
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
    });
    const sessionData = await sessionResponse.json().catch(() => ({}));

    if (!sessionResponse.ok) {
        return { ok: false, error: sessionData.error || "La session n’a pas pu être vérifiée. Réessayez." };
    }

    window.location.assign("/");
}
