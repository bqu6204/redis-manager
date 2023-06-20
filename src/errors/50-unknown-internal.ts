import { CustomError } from './core/_custom-error';

class UnknownInternalError50 extends CustomError {
    code = 50;

    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, UnknownInternalError50.prototype);
    }
}

export { UnknownInternalError50 };
