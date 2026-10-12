import express from "express";
import cookieParser from "cookie-parser";
import createError from "http-errors";
import { UserDAO } from "./dao/userDao.js";
import { UserRepository } from "./repositories/userRepository.js";
import { UserService } from "./services/userService.js";
import { createUserController } from "./controllers/userController.js";
import { createAuthenticate } from "./middlewares/authenticate.js";

export function createApp({ database, secret }) {
    if (!secret) {
        throw new Error("La variable d'environnement SECRET est obligatoire.");
    }

    // Assemblage des dépendances : chaque couche ne reçoit que celle dont elle a besoin.
    const userDao = new UserDAO(database);
    const userRepository = new UserRepository(userDao);
    const userService = new UserService(userRepository, { secret });
    const userController = createUserController(userService);
    const authenticate = createAuthenticate(userService);

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

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
