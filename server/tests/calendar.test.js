/*
 * On teste les routes des calendriers avec de vraies requêtes HTTP et une base SQLite en mémoire.
 * Chaque test repart avec une base vide, sans toucher au fichier app.db du projet.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import Database from "better-sqlite3";
import { createApp } from "../app.js";

const secret = "test-only-secret-for-calendar-regressions";
const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const password = createHash("sha256").update("mot-de-passe-test").digest("hex");

// Prépare une base et un serveur pour un test
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

    // Envoie le corps en JSON quand il y en a un, avec le cookie de l'utilisateur s'il est donné
    async function request(path, { method = "GET", body, cookie } = {}) {
        const headers = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        assert.match(response.headers.get("content-type"), /^application\/json/);
        return { response, data: await response.json() };
    }

    // Crée un compte, se connecte et renvoie son id avec le cookie à réutiliser
    async function signUp(username) {
        const created = await request("/users/add", { method: "POST", body: { username, password } });
        assert.equal(created.response.status, 201);
        const login = await request("/users/login", { method: "POST", body: { username, password } });
        assert.equal(login.response.status, 200);
        return { id: created.data.id, cookie: login.response.headers.get("set-cookie").split(";")[0] };
    }

    // Crée un calendrier dont l'utilisateur devient propriétaire
    async function createCalendar(user, name = "Agenda initial") {
        const { response, data } = await request("/calendars", {
            method: "POST", body: { name }, cookie: user.cookie
        });
        assert.equal(response.status, 201);
        return data;
    }

    // Le partage n'existe pas encore : on ajoute directement le membre en base
    function addMember(calendarId, userId, permission) {
        database.prepare(`
            INSERT INTO calendarUser (calendar_id, user_id, permission_id)
            SELECT ?, ?, id FROM permissionType WHERE label = ?
        `).run(calendarId, userId, permission);
    }

    function storedName(calendarId) {
        return database.prepare("SELECT name FROM calendar WHERE id = ?").get(calendarId)?.name;
    }

    return { database, request, signUp, createCalendar, addMember, storedName };
}

// Le propriétaire renomme son calendrier : le nom est nettoyé et enregistré en base
test("the owner can rename a calendar, with surrounding spaces removed", async t => {
    const { request, signUp, createCalendar, storedName } = await fixture(t);
    const owner = await signUp("owner");
    const calendar = await createCalendar(owner);

    const { response, data } = await request(`/calendars/${calendar.id}`, {
        method: "PATCH", body: { name: "  Agenda perso  " }, cookie: owner.cookie
    });

    assert.equal(response.status, 200);
    assert.deepEqual(data, { id: calendar.id, name: "Agenda perso", permission: "proprietaire" });
    assert.equal(storedName(calendar.id), "Agenda perso");

    const list = await request("/calendars", { cookie: owner.cookie });
    assert.deepEqual(list.data, [data]);
});

// La liste donne le droit de l'utilisateur sur chaque calendrier : le menu s'en sert pour séparer ses agendas des agendas partagés
test("the calendar list gives the user's permission on owned and shared calendars", async t => {
    const { request, signUp, createCalendar, addMember } = await fixture(t);
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const own = await createCalendar(alice, "Perso");
    const edited = await createCalendar(bob, "Equipe");
    const visited = await createCalendar(bob, "Famille");
    await createCalendar(bob, "Prive");
    addMember(edited.id, alice.id, "editeur");
    addMember(visited.id, alice.id, "visiteur");

    const { response, data } = await request("/calendars", { cookie: alice.cookie });

    assert.equal(response.status, 200);
    assert.deepEqual(data, [
        { id: edited.id, name: "Equipe", permission: "editeur" },
        { id: visited.id, name: "Famille", permission: "visiteur" },
        { id: own.id, name: "Perso", permission: "proprietaire" }
    ]);
});

// Un éditeur, un visiteur ou un non-membre ne peuvent pas renommer : le nom ne change pas
test("editors, visitors and non-members cannot rename a calendar", async t => {
    const { request, signUp, createCalendar, addMember, storedName } = await fixture(t);
    const owner = await signUp("owner");
    const editor = await signUp("editor");
    const visitor = await signUp("visitor");
    const stranger = await signUp("stranger");
    const calendar = await createCalendar(owner);
    addMember(calendar.id, editor.id, "editeur");
    addMember(calendar.id, visitor.id, "visiteur");

    for (const user of [editor, visitor, stranger]) {
        const { response, data } = await request(`/calendars/${calendar.id}`, {
            method: "PATCH", body: { name: "Piraté" }, cookie: user.cookie
        });
        assert.equal(response.status, 403);
        assert.deepEqual(data, { error: "Seul le propriétaire peut renommer ce calendrier." });
    }
    assert.equal(storedName(calendar.id), "Agenda initial");
});

// Un calendrier inexistant donne 404, un identifiant mal formé donne 400
test("renaming an unknown calendar returns 404 and a malformed id returns 400", async t => {
    const { request, signUp } = await fixture(t);
    const owner = await signUp("owner");

    const missing = await request("/calendars/999", {
        method: "PATCH", body: { name: "Nouveau nom" }, cookie: owner.cookie
    });
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.data, { error: "Calendrier introuvable." });

    for (const id of ["12abc", "0", "-1"]) {
        const { response } = await request(`/calendars/${id}`, {
            method: "PATCH", body: { name: "Nouveau nom" }, cookie: owner.cookie
        });
        assert.equal(response.status, 400, `Unexpected status for id ${id}`);
    }
});

// Les noms vides, du mauvais type ou accompagnés d'autres champs sont refusés sans modifier la base
test("invalid rename data returns 400 without changing the name", async t => {
    const { request, signUp, createCalendar, storedName } = await fixture(t);
    const owner = await signUp("owner");
    const calendar = await createCalendar(owner);
    const invalidBodies = [
        {},
        { name: "" },
        { name: "   " },
        { name: 42 },
        { name: null },
        { name: ["Agenda"] },
        { name: "Agenda", other: 1 },
        ["Agenda"]
    ];

    for (const body of invalidBodies) {
        const { response, data } = await request(`/calendars/${calendar.id}`, {
            method: "PATCH", body, cookie: owner.cookie
        });
        assert.equal(response.status, 400, `Unexpected status for ${JSON.stringify(body)}`);
        assert.deepEqual(Object.keys(data), ["error"]);
    }
    assert.equal(storedName(calendar.id), "Agenda initial");
});

// Sans cookie de connexion, la route refuse l'accès
test("renaming without being logged in returns 401", async t => {
    const { request, signUp, createCalendar, storedName } = await fixture(t);
    const owner = await signUp("owner");
    const calendar = await createCalendar(owner);

    const { response } = await request(`/calendars/${calendar.id}`, {
        method: "PATCH", body: { name: "Nouveau nom" }
    });
    assert.equal(response.status, 401);
    assert.equal(storedName(calendar.id), "Agenda initial");
});

// Un ancien token peut survivre à la suppression du compte : il ne doit plus permettre de renommer
test("renaming with the token of a deleted account returns 401", async t => {
    const { database, request, signUp, createCalendar, storedName } = await fixture(t);
    const owner = await signUp("owner");
    const calendar = await createCalendar(owner);
    database.prepare("DELETE FROM user WHERE id = ?").run(owner.id);

    const { response } = await request(`/calendars/${calendar.id}`, {
        method: "PATCH", body: { name: "Nouveau nom" }, cookie: owner.cookie
    });
    assert.equal(response.status, 401);
    assert.equal(storedName(calendar.id), "Agenda initial");
});

// La validation partagée avec le renommage ne doit pas changer le comportement de la création
test("calendar creation still validates and trims the name", async t => {
    const { database, request, signUp } = await fixture(t);
    const owner = await signUp("owner");

    for (const body of [{}, { name: "" }, { name: "   " }, { name: 42 }, { name: "Agenda", other: 1 }]) {
        const { response } = await request("/calendars", { method: "POST", body, cookie: owner.cookie });
        assert.equal(response.status, 400, `Unexpected status for ${JSON.stringify(body)}`);
    }
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM calendar").get().count, 0);

    const { response, data } = await request("/calendars", {
        method: "POST", body: { name: "  Travail  " }, cookie: owner.cookie
    });
    assert.equal(response.status, 201);
    assert.equal(data.name, "Travail");
    assert.equal(data.permission, "proprietaire");
});
