import { CustomError } from './core/_custom-error';

class RedlockInternalError30 extends CustomError {
    code = 30;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, RedlockInternalError30.prototype);
    }
}

export { RedlockInternalError30 };
