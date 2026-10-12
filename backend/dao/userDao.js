export class UserDAO {
    constructor(database) {
        this.database = database;
    }

    // Ici on fait juste l'INSERT, l'id et le hash ont déjà été préparés par le service.
    // Les ? permettent de passer les valeurs sans les coller dans le texte du SQL.
    create({ id, username, email, password_hash }) {
        return this.database.prepare(
            "INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)"
        ).run(id, username, email, password_hash);
    }

    // On cherche le compte par son pseudo. get() renvoie une ligne, ou undefined si rien trouvé.
    findByUsername(username) {
        return this.database.prepare(
            "SELECT id, username, email, password_hash FROM user WHERE username = ?"
        ).get(username);
    }
}
