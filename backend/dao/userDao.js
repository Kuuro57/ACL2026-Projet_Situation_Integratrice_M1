export class UserDAO {
    constructor(database) {
        this.database = database;
    }

    create({ id, username, email, password_hash }) {
        return this.database.prepare(
            "INSERT INTO user (id, username, email, password_hash) VALUES (?, ?, ?, ?)"
        ).run(id, username, email, password_hash);
    }

    findByUsername(username) {
        return this.database.prepare(
            "SELECT id, username, email, password_hash FROM user WHERE username = ?"
        ).get(username);
    }
}
