abstract class CustomError extends Error {
    abstract readonly code: number;
    constructor(message: string, error?: unknown) {
        super(message);

        console.error('[ ERROR ] Redis-Manager: ' + message, error ?? '');

        Object.setPrototypeOf(this, CustomError.prototype);
    }
}

export { CustomError };
