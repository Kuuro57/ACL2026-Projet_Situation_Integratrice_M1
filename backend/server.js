import express from "express";
import { UserController } from "./controllers/userController.js"
import createError from "http-errors";


const app = express();
const port = 3000;

// Initialisation du serveur Express
app.use(express.json());
app.use(express.urlencoded({ extended: false }));



// Routes requête SQL
app
    .post('/users', UserController.create);



// Gestion route introuvable
app.use((req, res, next) => {
    next(createError(404));
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
    res.status(err.status || 500).send(`<h1>${err.message}</h1>`);
});



// Début de l'écoute du serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
