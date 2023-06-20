import { CustomError } from './core/_custom-error';

class KeyExistError10 extends CustomError {
    code = 10;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, KeyExistError10.prototype);
    }
}

export { KeyExistError10 };
