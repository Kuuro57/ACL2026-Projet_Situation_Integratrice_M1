import "express";
import { randomUUID } from "node:crypto";
import db from "../database/db.js";

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
            const { username, email, password: hasedPassword } = req.query ?? {};
            const id = randomUUID();

            db.prepare("INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)")
                .run(id, username, email ?? null, hasedPassword);

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
