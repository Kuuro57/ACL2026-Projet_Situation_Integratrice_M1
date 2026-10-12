import express from "express";
import cookieParser from "cookie-parser";
import createError from "http-errors";
import { UserDAO } from "./dao/userDao.js";
import { UserRepository } from "./repositories/userRepository.js";
import { UserService } from "./services/userService.js";
import { createUserController } from "./controllers/userController.js";
import { createAuthenticate } from "./middlewares/authenticate.js";

// On prépare l'app Express avec la BDD et le secret qu'on nous passe.
// On lance pas le serveur ici, ça permet aussi aux tests d'utiliser leur propre BDD.
export function createApp({ database, secret }) {
    if (!secret) {
        throw new Error("La variable d'environnement SECRET est obligatoire.");
    }

    // On branche les couches dans l'ordre : DAO -> repository -> service -> contrôleur.
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

    // Si aucune route au-dessus correspond, on passe une erreur 404 au gestionnaire suivant.
    app.use((req, res, next) => {
        next(createError(404));
    });

    // Dernier passage pour les erreurs qui ont été envoyées avec next(err).
    app.use((err, req, res, next) => {
        res.status(err.status || 500).send(`<h1>${err.message}</h1>`);
    });

    return app;
}
