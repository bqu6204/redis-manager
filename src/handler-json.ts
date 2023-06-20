import { UnknownInternalError50 } from './errors';

interface IJSONHandler<V> {
    serialize: (value: V) => string | Buffer | number | null;
    parse: (value: string) => V;
}

class JSONHandler<V> implements IJSONHandler<V> {
    private readonly BIGINT_TAG = '<JSON_HANDLER_BIGINT_TAG>';
    private readonly BUFFER_TAG = '<JSON_HANDLER_BUFFER_TAG>';

    private isJSONString(value: any): boolean {
        // check if value can be JSON.parsed()
        // eg. boolean, number , null, valid object, array.
        if (typeof value !== 'string') return false;

        /* eslint-disable */
        if (value.trim().length === 0) return false;
        value = value.replace(/\\(?:["\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
        value = value.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
        value = value.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        /* eslint-enable */
        return /^[\],:{}\s]*$/.test(value);
    }

    private isBigintString(value: any): boolean {
        return typeof value === 'string' && value.startsWith(this.BIGINT_TAG) && value.endsWith(this.BIGINT_TAG);
    }

    private isBufferString(value: any): boolean {
        return typeof value === 'string' && value.startsWith(this.BUFFER_TAG) && value.endsWith(this.BUFFER_TAG);
    }

    parse(value: string): V {
        if (typeof value !== 'number' && typeof value !== 'string' && !Buffer.isBuffer(value)) {
            throw new UnknownInternalError50('Value from Redis should be either a number, string, or Buffer.');
        }

        if (this.isBufferString(value)) {
            return Buffer.from(value.replaceAll(this.BUFFER_TAG, ''), 'hex') as V;
        }
        if (this.isBigintString(value)) {
            return BigInt(value.replaceAll(this.BIGINT_TAG, '')) as V;
        }

        if (this.isJSONString(value)) {
            return JSON.parse(value) as V;
        }

        return value as V;
    }

    serialize(value: V): string | number | Buffer {
        if (Buffer.isBuffer(value)) {
            const bufferString = this.BUFFER_TAG + value.toString('hex') + this.BUFFER_TAG;
            return bufferString;
        }
        if (typeof value === 'number' || typeof value === 'string') {
            return value;
        }

        if (typeof value === 'undefined' || value === null) {
            return JSON.stringify(null);
        }

        if (typeof value === 'bigint') {
            const bigintString = this.BIGINT_TAG + value.toString() + this.BIGINT_TAG;
            return bigintString;
        }

        return JSON.stringify(value);
    }
}

export { JSONHandler };
