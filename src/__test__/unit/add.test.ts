import { redisClient } from '../../__test-setup/setup-files-after-env';
import { KeyExistError10, RedisInternalError30 } from '../../errors';
import { RedisManager } from '../../redis-manager';

let redisManager: any;

beforeAll(() => {
    redisManager = new RedisManager({
        client: redisClient,
        namespace: 'add',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('Add various value types to storage', () => {
    test('add object', async () => {
        const data = { key: 'object', value: { data: 'random' } };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value.data).toBe('random');
    });

    test('add null', async () => {
        const data = { key: 'null', value: null };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('add array', async () => {
        const data = { key: 'array', value: [1, 2, 3] };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual([1, 2, 3]);
    });

    test('add undefined', async () => {
        const data = { key: 'undefined', value: undefined };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('add boolean', async () => {
        const data = { key: 'boolean', value: true };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(true);
    });

    test('add string', async () => {
        const data = { key: 'string', value: 'hello' };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe('hello');
    });

    test('add number', async () => {
        const data = { key: 'number', value: 42 };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(42);
    });

    test('add bigint', async () => {
        const data = { key: 'bigint', value: BigInt(123456789) };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(BigInt(123456789));
    });

    test('add buffer', async () => {
        const data = { key: 'buffer', value: Buffer.from('data') };

        const result = await redisManager!.add(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(Buffer.from('data'));
    });
});

describe('Key already exists in storage', () => {
    test('throw KeyExistError10 (code: 10)', async () => {
        const data1 = { key: 'exist_key', value: null };
        const data2 = { key: 'exist_key', value: null };

        const result = await redisManager!.add(data1);
        expect(result).toBe('OK');

        await expect(redisManager!.add(data2)).rejects.toThrow(KeyExistError10);
    });
});

describe('Failed to add key for unexpected reason', () => {
    test('throw RedisInternalError30 (code: 30) and logs the error out', async () => {
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

        await expect(redisManager.add(data)).rejects.toThrow(RedisInternalError30);
        expect(mockExec).toHaveBeenCalled();
    });
});

describe('Add key with expiration time', () => {
    test('Successfully added', async () => {
        const data = { key: 'expiration_time', value: Buffer.from('data') };
        const redisManager = new RedisManager({
            client: redisClient,
            namespace: 'add-expire-success',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.add(data)).resolves.toBe('OK');
    });

    test('fails with throwing RedisInternalError30 (code: 30)', async () => {
        const data = { key: 'expiresMs', value: Buffer.from('data'), lockTTL: 1000 };

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
            namespace: 'add-expire-failed',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.add(data)).rejects.toThrow(RedisInternalError30);

        expect(mockExec).toHaveBeenCalled();
    });
});
