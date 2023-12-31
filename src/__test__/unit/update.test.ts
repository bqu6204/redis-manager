import { redisClient } from '../../__test-setup/setup-files-after-env';
import { KeyNotExistError11, RedisInternalError30 } from '../../errors';
import { RedisManager } from '../../redis-manager';

let redisManager: any;

beforeAll(async () => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'update',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('Update various value types to storage', () => {
    test('update object', async () => {
        const data = { key: 'object', value: { data: 'random' } };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value.data).toBe('random');
    });

    test('update null', async () => {
        const data = { key: 'null', value: null };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('update array', async () => {
        const data = { key: 'array', value: [1, 2, 3] };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual([1, 2, 3]);
    });

    test('update undefined', async () => {
        const data = { key: 'undefined', value: undefined };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('update boolean', async () => {
        const data = { key: 'boolean', value: true };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(true);
    });

    test('update string', async () => {
        const data = { key: 'string', value: 'hello' };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe('hello');
    });

    test('update number', async () => {
        const data = { key: 'number', value: 42 };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(42);
    });

    test('update bigint', async () => {
        const data = { key: 'bigint', value: BigInt(123456789) };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(BigInt(123456789));
    });

    test('update buffer', async () => {
        const data = { key: 'buffer', value: Buffer.from('data') };

        await redisManager!.add(data);
        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(Buffer.from('data'));
    });
});

describe('Key does not exist in storage', () => {
    it('throws KeyNotExistError11 (code: 11)', async () => {
        const data = { key: 'not-exist', value: null };
        await redisClient.del(data.key);
        await expect(redisManager.update(data)).rejects.toThrow(KeyNotExistError11);
    });
});

describe('Failed to update key for unexpected reason', () => {
    it('throws RedisInternalError30 (code: 30) ', async () => {
        const data = { key: 'unexpected-error', value: Buffer.from('data') };

        const mockExec = jest.fn().mockReturnValue(null);
        const mockClient = {
            pipeline: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            pexpire: jest.fn().mockReturnThis(),
            exec: mockExec,
        };

        const redisManager = new RedisManager({
            client: mockClient as any,
            namespace: 'key-value',
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.update(data)).rejects.toThrow(RedisInternalError30);
        expect(mockExec).toHaveBeenCalled();
    });
});

describe('Update key with expire time ', () => {
    it('Successfully udpates  ', async () => {
        const data = { key: 'expire-time', value: Buffer.from('data') };
        const redisManager = new RedisManager({
            client: redisClient,
            namespace: 'update-expire-success',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await redisManager!.add(data);
        await expect(redisManager.update(data)).resolves.toBe('OK');
    });

    it('Fails with throwing RedisInternalError30 (code: 30)', async () => {
        const data = { key: 'expire-time', value: Buffer.from('data') };

        const mockExec = jest.fn().mockReturnValue([
            [null, 'OK'],
            [null, null],
        ]);

        const mockClient = {
            pipeline: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            pexpire: jest.fn().mockReturnThis(),
            exec: mockExec,
        };

        const redisManager = new RedisManager({
            client: mockClient as any,
            namespace: 'update-expire-failed',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.update(data)).rejects.toThrow(RedisInternalError30);

        expect(mockExec).toHaveBeenCalled();
    });
});
