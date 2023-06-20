import { KeyInvalidError12 } from './errors/12-key-invalid';

interface IPrefixHandler {
    concat(key: string): string;
    split(prefixedKey: string): string;
}

class PrefixHandler implements IPrefixHandler {
    private readonly _prefix: string;

    constructor({ namespace }: { namespace: string }) {
        this._prefix = namespace + ':';
    }

    concat(key: string): string {
        if (typeof key !== 'string') throw new KeyInvalidError12(`Key: ${JSON.stringify(key)} is not a string`);
        return this._prefix + key;
    }

    split(prefixedKey: string): string {
        return prefixedKey.replace(this._prefix, '');
    }
}

export { IPrefixHandler, PrefixHandler };
