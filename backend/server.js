// A COMPLETER
import express from "express";
import path from "path";


const app = express();
const PORT = 3000;

const __dirname = path.resolve(path.dirname('')); 

app.get('/', (req, res) => {
    res.sendFile( __dirname +"/frontend/html/index.html");
});

app.listen(PORT, () => {
    console.log(`Server is listening at http://localhost:${PORT}`);
});