import express from "express";
import cookieParser from "cookie-parser";
import createError from "http-errors";
import { UserDAO } from "./dao/userDao.js";
import { UserRepository } from "./repositories/userRepository.js";
import { UserService } from "./services/userService.js";
import { createUserController } from "./controllers/userController.js";
import { createAuthenticate } from "./middlewares/authenticate.js";
import { EventDAO } from "./dao/eventDao.js";
import { EventRepository } from "./repositories/eventRepository.js";
import { EventService } from "./services/eventService.js";
import { createEventController } from "./controllers/eventController.js";
import { CalendarDAO } from "./dao/calendarDao.js";
import { CalendarRepository } from "./repositories/calendarRepository.js";
import { CalendarService } from "./services/calendarService.js";
import { createCalendarController } from "./controllers/calendarController.js";
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
  const eventDao = new EventDAO(database);
  const eventRepository = new EventRepository(eventDao);
  const eventService = new EventService(eventRepository);
  const eventController = createEventController(eventService);
  const calendarDao = new CalendarDAO(database);
  const calendarRepository = new CalendarRepository(calendarDao);
  const calendarService = new CalendarService(calendarRepository);
  const calendarController = createCalendarController(calendarService);

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
  app.get("/", (req, res) => {
    res.render("login", {
      title: "Se connecter",
    });
  });

  // Routes API
  app
    .post("/users/add", userController.create)
    .post("/users/login", userController.login)
    .get("/users/me", authenticate, userController.me);

  app
    .post("/calendars", authenticate, calendarController.create)
    .get("/calendars/:calendarId/week", authenticate, calendarController.getWeek);

  app
    .post("/calendars/:calendarId/events", authenticate, eventController.create)
    .patch("/calendars/:calendarId/events/:eventId", authenticate, eventController.update)
    .delete("/calendars/:calendarId/events/:eventId", authenticate, eventController.delete);

  app.use((req, res, next) => {
    next(createError(404));
  });

  // Un gestionnaire pour envoyer les erreurs en JSON
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = err.status || 500;
    const message = status === 400 ? "Requête invalide." : err.message;
    return res.status(status).json({
      error: status >= 500 ? "Erreur interne du serveur." : message,
    });
  });

  return app;
}
