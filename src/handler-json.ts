interface IJSONHandler<V> {
    serialize: (value: V) => string | Buffer | number | null;
    parse: (value: string) => V;
}

class JSONHandler<V> implements IJSONHandler<V> {
    parse(value: string | number | Buffer): V {
        if (Buffer.isBuffer(value) || typeof value === 'number') return value as V;
        if (typeof value === 'bigint') return BigInt(value) as V;
        return JSON.parse(value) as V;
    }
    serialize(value: V): string | number | Buffer {
        if (typeof value === 'undefined' || value === null) return JSON.stringify(null);
        if (Buffer.isBuffer(value)) return value;
        if (typeof value === 'object' || typeof value === 'boolean') return JSON.stringify(value);

        return value as string | number;
    }
}

export { JSONHandler };
