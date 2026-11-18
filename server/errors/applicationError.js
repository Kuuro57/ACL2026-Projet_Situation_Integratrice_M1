// Une erreur avec un code que le contrôleur peut traduire en statut HTTP.
// On garde aussi l'erreur d'origine dans cause quand il y en a une.
export class ApplicationError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "ApplicationError";
        this.code = code;
    }
}
