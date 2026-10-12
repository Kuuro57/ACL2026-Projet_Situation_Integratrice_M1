export class ApplicationError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "ApplicationError";
        this.code = code;
    }
}
