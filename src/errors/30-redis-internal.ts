import { CustomError } from './core/_custom-error';

class RedisInternalError30 extends CustomError {
    code = 30;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, RedisInternalError30.prototype);
    }
}

export { RedisInternalError30 };
