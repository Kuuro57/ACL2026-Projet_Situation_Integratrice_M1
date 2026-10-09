import "express";
import { randomUUID } from "node:crypto";
import db from "../database/db.js";

export const UserController = {

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
