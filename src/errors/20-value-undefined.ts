import { CustomError } from './core/_custom-error';

class ValueUndefiendError20 extends CustomError {
    code = 20;
    constructor(message?: string, error?: unknown) {
        const defaultMessage = 'Value cannot be undefined';
        super(message ?? defaultMessage, error);

        Object.setPrototypeOf(this, ValueUndefiendError20.prototype);
    }
}

export { ValueUndefiendError20 };
