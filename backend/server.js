import express from "express";
import { UserController } from "./controllers/userController.js"

const app = express();
app.use(express.json());
const port = 3000;

// Routes
app.get('/users', UserController.getAll);
app.get('/users/:id', UserController.getById);
app.post('/users', UserController.create);


app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
