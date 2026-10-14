import express from "express";
import cookieParser from "cookie-parser";
import createError from "http-errors";
import { UserDAO } from "./dao/userDao.js";
import { UserRepository } from "./repositories/userRepository.js";
import { UserService } from "./services/userService.js";
import { createUserController } from "./controllers/userController.js";
import { createAuthenticate } from "./middlewares/authenticate.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prépare l'application Express
 * @param {Object} options Options de création de l'application
 * @param {import("better-sqlite3").Database} options.database Base de données SQLite
 * @param {string} options.secret Clé secrète utilisée pour signer les JWT
 * @returns {import("express").Express} Application Express initialisée
 * @throws {Error} Si la clé secrète n'est pas renseignée
 */
export function createApp({ database, secret }) {
  if (!secret) {
    throw new Error("La variable d'environnement SECRET est obligatoire.");
  }

  // On branche les couches dans l'ordre : DAO -> repository -> service -> contrôleur
  const userDao = new UserDAO(database);
  const userRepository = new UserRepository(userDao);
  const userService = new UserService(userRepository, { secret });
  const userController = createUserController(userService);
  const authenticate = createAuthenticate(userService);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  const frontendDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../frontend",
  );

  app.set("view engine", "ejs");
  app.set("views", path.join(frontendDirectory, "view"));
  app.use("/assets", express.static(path.join(frontendDirectory, "public")));

  app.get("/creation-compte", (req, res) => {
    res.render("creation-compte", {
      title: "Créer un compte",
    });
  });

  // Routes API
  app
    .post("/users/add", userController.create)
    .post("/users/login", userController.login)
    .get("/users/me", authenticate, userController.me);

  app.use((req, res, next) => {
    next(createError(404));
  });

  app.use((err, req, res, next) => {
    res.status(err.status || 500).send(`<h1>${err.message}</h1>`);
  });

  return app;
}
