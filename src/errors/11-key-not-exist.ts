import { CustomError } from './core/_custom-error';

class KeyNotExistError11 extends CustomError {
    code = 11;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, KeyNotExistError11.prototype);
    }
}

export { KeyNotExistError11 };
