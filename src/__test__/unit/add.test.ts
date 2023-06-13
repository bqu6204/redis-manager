describe('Redis Manager - Add various value types to storage', () => {
    test('add object', async () => {
        const data = { key: 'object', value: { data: 'random' } };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value.data).toBe('random');
    });

    test('add null', async () => {
        const data = { key: 'null', value: null };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toBeNull();
    });

    test('add array', async () => {
        const data = { key: 'array', value: [1, 2, 3] };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toEqual([1, 2, 3]);
    });

    test('add undefined', async () => {
        const data = { key: 'undefined', value: undefined };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toBeNull();
    });

    test('add boolean', async () => {
        const data = { key: 'boolean', value: true };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toBe(true);
    });

    test('add string', async () => {
        const data = { key: 'string', value: 'hello' };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toBe('hello');
    });

    test('add number', async () => {
        const data = { key: 'number', value: 42 };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toBe(42);
    });

    test('add bigint', async () => {
        const data = { key: 'bigint', value: BigInt(123456789) };

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toEqual(BigInt(123456789));
    });

    test('add buffer', async () => {
        const data = { key: 'buffer', value: Buffer.from('data') };

        console.log('Buffer from "data" : ', Buffer.from('data'));

        const result = await global.keyValueStorage!.add(data);
        expect(result).toBe('OK');

        const value = await global.keyValueStorage!.get(data.key);
        expect(value).toEqual(Buffer.from('data'));
    });
});
