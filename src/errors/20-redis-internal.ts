import { CustomError } from './core/_custom-error';

class RedisInternalError20 extends CustomError {
    code = 20;
    constructor(message: string, error?: unknown) {
        super(message, error);

        Object.setPrototypeOf(this, RedisInternalError20.prototype);
    }
}

export { RedisInternalError20 };
