import { CustomError } from './core/_custom-error';

class KeyInvalidError12 extends CustomError {
    code = 12;

    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, KeyInvalidError12.prototype);
    }
}

export { KeyInvalidError12 };
