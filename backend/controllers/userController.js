import "express";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import db from "../database/db.js";

const scrypt = promisify(scryptCallback);

export const UserController = {

    /**
     * Récupère tous les utilisateurs
     * @param {Request} req
     * @param {Response} res
     * @returns La liste de tous les utilisateurs (id, username, email)
     */
    async getAll(req, res) {
        try {
            const users = db.prepare("SELECT id, username, email FROM user").all();
            return res.json(users);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
        }
    },

    /**
     * Récupère un utilisateur à partir d'un identifiant
     * @param {Request} req
     * @param {Response} res
     * @returns Les données de l'utilisateur (id, username, email)
     */
    async getById(req, res) {
        try {
            let userId = req.params.id;
            const user = db.prepare("SELECT id, username, email FROM user WHERE id = ?").get(userId);
            return res.json(user);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
        }
    },

    /**
     * Ajoute un nouvel utilisateur en BD
     * @param {Request} req
     * @param {Response} res
     * @returns Les données de l'utilisateur créé (id, username, email) avec le statut 201
     */
    async create(req, res) {
        try {
            console.log(req);
            const { username, email, password } = req.body ?? {};

            if (!username || !password) {
                return res.status(400).json({ error: "Le nom d'utilisateur et le mot de passe sont obligatoires" });
            }

            // Hachage du mot de passe
            const salt = randomBytes(16).toString("hex");
            const hash = (await scrypt(password, salt, 64)).toString("hex");
            const passwordHash = `${salt}:${hash}`;

            const id = randomUUID();
            db.prepare("INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)")
                .run(id, username, email ?? null, passwordHash);

            return res.status(201).json({ id, username, email: email ?? null });
        } catch (err) {
            if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({ error: "Ce nom d'utilisateur est déjà utilisé" });
            }
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
        }
    }

}
