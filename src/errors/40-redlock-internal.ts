import { CustomError } from './core/_custom-error';

class RedlockInternalError40 extends CustomError {
    code = 40;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, RedlockInternalError40.prototype);
    }
}

export { RedlockInternalError40 };
