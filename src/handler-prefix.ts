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
        return this._prefix + key;
    }

    split(prefixedKey: string): string {
        return prefixedKey.replace(this._prefix, '');
    }
}

export { IPrefixHandler, PrefixHandler };
