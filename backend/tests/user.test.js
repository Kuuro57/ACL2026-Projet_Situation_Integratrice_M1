/*
 * On teste les routes avec de vraies requêtes HTTP et une base SQLite en mémoire.
 * Chaque test repart avec une base vide, sans toucher au fichier app.db du projet.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";

const secret = "test-only-secret-for-user-regressions";
const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const credentials = {
    username: "alice",
    email: "alice@example.test",
    password: "client-password-hash"
};

// Prépare une base et un serveur pour un test. Le port 0 laisse le système choisir
// un port disponible, puis t.after ferme tout, même si une assertion échoue.
async function fixture(t) {
    const database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    database.exec(schema);
    const server = createApp({ database, secret }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        if (database.open) database.close();
    });

    // Envoie le corps en JSON quand il y en a un, puis récupère la réponse JSON.
    // On garde aussi la réponse HTTP pour vérifier le statut et les cookies.
    async function request(path, { method = "GET", body, headers = {} } = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        assert.match(response.headers.get("content-type"), /^application\/json/);
        return { response, data: await response.json() };
    }

    return { database, baseUrl, request };
}

// Vérifie les champs qu'on peut renvoyer au client : un UUID, le nom et l'email.
// La liste exacte des clés permet aussi de repérer une fuite du hash du mot de passe.
function assertPublicUser(user, expected) {
    assert.deepEqual(Object.keys(user).sort(), ["email", "id", "username"]);
    assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(user.username, expected.username);
    assert.equal(user.email, expected.email ?? null);
}

// Après une création, on compare la réponse avec ce qui a vraiment été enregistré.
// Le hash doit rester en base et l'identifiant doit être un UUID généré par le serveur.
test("creating a user stores a UUID and hashed password, and returns only public data", async t => {
    const { database, request } = await fixture(t);
    const { response, data } = await request("/users/add", { method: "POST", body: credentials });

    assert.equal(response.status, 201);
    assertPublicUser(data, credentials);
    const stored = database.prepare("SELECT * FROM user WHERE id = ?").get(data.id);
    assert.deepEqual(stored, {
        id: data.id,
        username: credentials.username,
        email: credentials.email,
        password_hash: createHash("sha256").update(credentials.password).digest("base64")
    });
    assert.notEqual(stored.password_hash, credentials.password);
});

// L'ancien appel avec les champs dans l'URL doit continuer à créer un utilisateur.
test("the existing query-parameter creation endpoint works without a request body", async t => {
    const { request } = await fixture(t);
    const query = new URLSearchParams(credentials);
    const { response, data } = await request(`/users/add?${query}`, { method: "POST" });

    assert.equal(response.status, 201);
    assertPublicUser(data, credentials);
});

// Si le corps JSON et l'URL donnent des valeurs différentes, on attend celles du corps.
test("JSON creation data takes precedence over query parameters", async t => {
    const { request } = await fixture(t);
    const { response, data } = await request("/users/add?username=query-user&password=query-password", {
        method: "POST",
        body: credentials
    });

    assert.equal(response.status, 201);
    assertPublicUser(data, credentials);
});

// On accepte aussi les données de formulaire et plusieurs comptes sans email.
// Un email absent ou null doit être enregistré et renvoyé comme null.
test("form-encoded creation and optional emails remain supported", async t => {
    const { baseUrl, request, database } = await fixture(t);
    const response = await fetch(`${baseUrl}/users/add`, {
        method: "POST",
        body: new URLSearchParams({ username: "form-user", password: "form-password" })
    });
    assert.equal(response.status, 201);
    assertPublicUser(await response.json(), { username: "form-user" });

    const second = await request("/users/add", {
        method: "POST",
        body: { username: "another-user", email: null, password: "another-password" }
    });
    assert.equal(second.response.status, 201);
    assertPublicUser(second.data, { username: "another-user" });
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user WHERE email IS NULL").get().count, 2);
});

// On essaie un nom déjà pris, puis un email déjà pris : les deux doivent renvoyer 409.
// Les messages doivent expliquer le doublon et aucun compte supplémentaire ne doit être créé.
test("username and email uniqueness conflicts retain their public messages", async t => {
    const { request, database } = await fixture(t);
    await request("/users/add", { method: "POST", body: credentials });

    const duplicateUsername = await request("/users/add", {
        method: "POST",
        body: { ...credentials, email: "different@example.test" }
    });
    assert.equal(duplicateUsername.response.status, 409);
    assert.deepEqual(duplicateUsername.data, { error: "Ce nom d'utilisateur est déjà utilisé." });

    const duplicateEmail = await request("/users/add", {
        method: "POST",
        body: { ...credentials, username: "different-user" }
    });
    assert.equal(duplicateEmail.response.status, 409);
    assert.deepEqual(duplicateEmail.data, { error: "Cet email est déjà associée à un compte." });
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user").get().count, 1);
});

// Les champs manquants, vides ou du mauvais type doivent être refusés avec un statut 400.
// On vérifie à la fin qu'aucune de ces tentatives n'a ajouté de ligne en base.
test("invalid creation data returns 400 without inserting users", async t => {
    const { request, database } = await fixture(t);
    const invalidBodies = [
        {},
        { username: "alice" },
        { password: "password" },
        { username: "", password: "password" },
        { username: "alice", password: "" },
        { username: 42, password: "password" },
        { username: "alice", password: ["password"] },
        { username: "alice", password: "password", email: { address: "alice@example.test" } }
    ];

    for (const body of invalidBodies) {
        const { response, data } = await request("/users/add", { method: "POST", body });
        assert.equal(response.status, 400, `Unexpected status for ${JSON.stringify(body)}`);
        assert.deepEqual(Object.keys(data), ["error"]);
        assert.equal(typeof data.error, "string");
    }
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user").get().count, 0);
});

// On crée un compte, on se connecte, puis on réutilise le cookie pour appeler /me.
// Le token doit durer un jour et les réponses ne doivent jamais contenir le hash.
test("login returns a public user and a one-day JWT cookie; /me preserves its identity claims", async t => {
    const { request } = await fixture(t);
    const created = await request("/users/add", { method: "POST", body: credentials });
    const login = await request("/users/login", { method: "POST", body: credentials });

    assert.equal(login.response.status, 200);
    assert.deepEqual(login.data, { user: created.data });
    assertPublicUser(login.data.user, credentials);

    const cookie = login.response.headers.get("set-cookie");
    assert.match(cookie, /^accessToken=/);
    assert.match(cookie, /; HttpOnly(?:;|$)/i);
    assert.match(cookie, /; SameSite=Lax(?:;|$)/i);
    assert.match(cookie, /; Max-Age=86400(?:;|$)/i);
    if (process.env.NODE_ENV !== "production") assert.doesNotMatch(cookie, /; Secure(?:;|$)/i);
    // Le navigateur renvoie seulement nom=valeur, sans les options de Set-Cookie.
    // On extrait le JWT de cette valeur pour vérifier sa signature et son contenu.
    const cookiePair = cookie.split(";")[0];
    const decoded = jwt.verify(decodeURIComponent(cookiePair.slice("accessToken=".length)), secret);
    assert.equal(decoded.id, created.data.id);
    assert.equal(decoded.username, credentials.username);
    assert.equal(decoded.exp - decoded.iat, 24 * 60 * 60);
    assert.equal(decoded.passwordHash, undefined);
    assert.equal(decoded.password_hash, undefined);

    const me = await request("/users/me", { headers: { Cookie: cookiePair } });
    assert.equal(me.response.status, 200);
    assert.deepEqual(me.data, { user: decoded });
});

// En production, le cookie de connexion doit avoir l'option Secure.
test("login uses a secure cookie in production", async t => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        const { request } = await fixture(t);
        await request("/users/add", { method: "POST", body: credentials });
        const login = await request("/users/login", { method: "POST", body: credentials });
        assert.equal(login.response.status, 200);
        assert.match(login.response.headers.get("set-cookie"), /; Secure(?:;|$)/i);
    } finally {
        // On remet l'environnement d'origine pour ne pas influencer les autres tests.
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
    }
});

// Un mauvais mot de passe ou un nom inconnu doivent donner la même erreur 401.
// Dans les deux cas, aucun cookie de connexion ne doit être envoyé.
test("incorrect login credentials return 401 without a session cookie", async t => {
    const { request } = await fixture(t);
    await request("/users/add", { method: "POST", body: credentials });

    for (const body of [
        { ...credentials, password: "incorrect-password" },
        { ...credentials, username: "unknown-user" }
    ]) {
        const { response, data } = await request("/users/login", { method: "POST", body });
        assert.equal(response.status, 401);
        assert.deepEqual(data, { error: "Nom d'utilisateur ou mot de passe incorrect." });
        assert.equal(response.headers.get("set-cookie"), null);
    }
});

// Une demande de connexion incomplète ou avec des types incorrects doit renvoyer 400.
test("missing and incorrectly typed login credentials return 400", async t => {
    const { request } = await fixture(t);
    for (const body of [
        {},
        { username: "alice" },
        { password: "password" },
        { username: 42, password: "password" },
        { username: "alice", password: { value: "password" } }
    ]) {
        const { response, data } = await request("/users/login", { method: "POST", body });
        assert.equal(response.status, 400);
        assert.deepEqual(Object.keys(data), ["error"]);
        assert.equal(response.headers.get("set-cookie"), null);
    }
});

// /me doit refuser l'accès sans cookie, avec un faux token, un token expiré
// ou un token signé avec une autre clé. On attend un statut 401 à chaque fois.
test("/me rejects missing, invalid, expired, and wrongly signed access tokens", async t => {
    const { request } = await fixture(t);
    const missing = await request("/users/me");
    assert.equal(missing.response.status, 401);
    assert.deepEqual(missing.data, { error: "Authentification requise." });

    const identity = { id: "user-id", username: "alice" };
    const tokens = [
        "not-a-jwt",
        jwt.sign(identity, secret, { expiresIn: -1 }),
        jwt.sign(identity, "another-secret", { expiresIn: "1d" })
    ];
    for (const token of tokens) {
        const { response, data } = await request("/users/me", {
            headers: { Cookie: `accessToken=${token}` }
        });
        assert.equal(response.status, 401);
        assert.deepEqual(data, { error: "Token invalide ou expiré." });
    }
});

// On simule une panne de base pour vérifier que les routes répondent en JSON avec un statut 500.
// La réponse doit rester lisible et ne pas exposer de détails SQL ou de mot de passe.
test("SQLite failures are controlled JSON errors without storage or password details", async t => {
    const { request, database } = await fixture(t);
    // La base est fermée volontairement : les erreurs affichées en console sont attendues.
    database.close();

    const creation = await request("/users/add", { method: "POST", body: credentials });
    assert.equal(creation.response.status, 500);
    assert.deepEqual(creation.data, { error: "Erreur lors de la création de l'utilisateur." });

    const login = await request("/users/login", { method: "POST", body: credentials });
    assert.equal(login.response.status, 500);
    assert.deepEqual(Object.keys(login.data), ["error"]);
    assert.equal(typeof login.data.error, "string");
    assert.doesNotMatch(JSON.stringify(login.data), /SQLITE|password_hash|client-password-hash|database connection/i);
    assert.equal(login.response.headers.get("set-cookie"), null);
});
