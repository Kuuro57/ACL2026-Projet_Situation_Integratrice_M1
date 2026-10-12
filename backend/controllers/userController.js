import "express";
import { randomUUID } from "node:crypto";
import crypto from "crypto"
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
            const { username, email, password: hashedPassword } = req.query ?? {};
            const id = randomUUID();
            const doubleHashedPassword = crypto.createHash('sha256').update(hashedPassword).digest('base64');

            db.prepare("INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)")
                .run(id, username, email ?? null, doubleHashedPassword);

            return res.status(201).json({ id, username, email: email ?? null });
        } catch (err) {
            if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
                let attributeDuplicate = err.message.split(" ");
                attributeDuplicate = attributeDuplicate[attributeDuplicate.length - 1];
                
                let message = "Impossible d'ajouter l'utilisateur (erreur de contrainte UNIQUE).";
                if (attributeDuplicate.includes("username")) {
                    message = "Ce nom d'utilisateur est déjà utilisé.";
                } else if (attributeDuplicate.includes("email")) {
                    message = "Cet email est déjà associée à un compte.";
                }

                return res.status(409).json({ error: message });
            }

            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la création de l'utilisateur." });
        }
    }

}
