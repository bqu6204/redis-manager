import { redisClient } from '../../__test-setup/setup-files-after-env';
import { RedisInternalError30 } from '../../errors';
import { RedisManager } from '../../redis-manager';

let redisManager: any;

beforeAll(() => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'upsert',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('upsert various value types to storage', () => {
    test('upsert object', async () => {
        const data = { key: 'object', value: { data: 'random' } };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value.data).toBe('random');

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert null', async () => {
        const data = { key: 'null', value: null };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert array', async () => {
        const data = { key: 'array', value: [1, 2, 3] };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual([1, 2, 3]);

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert undefined', async () => {
        const data = { key: 'undefined', value: undefined };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert boolean', async () => {
        const data = { key: 'boolean', value: true };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(true);

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert string', async () => {
        const data = { key: 'string', value: 'hello' };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe('hello');

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert number', async () => {
        const data = { key: 'number', value: 42 };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(42);

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert bigint', async () => {
        const data = { key: 'bigint', value: BigInt(123456789) };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(BigInt(123456789));

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });

    test('upsert buffer', async () => {
        const data = { key: 'buffer', value: Buffer.from('data') };

        const result = await redisManager!.upsert(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(Buffer.from('data'));

        const result2 = await redisManager!.upsert(data);
        expect(result2).toBe('OK');
    });
});

describe('Failed to upsert key for unexpected reason', () => {
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

        await expect(redisManager.add(data)).rejects.toThrow(RedisInternalError30);
        expect(mockExec).toHaveBeenCalled();
    });
});

describe('upsert key with expire time ', () => {
    it('Successfully udpates  ', async () => {
        const data = { key: 'expire-time', value: Buffer.from('data') };
        const redisManager = new RedisManager({
            client: redisClient,
            namespace: 'upsert-expire-success',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.upsert(data)).resolves.toBe('OK');
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
            namespace: 'upsert-expire-fail',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.upsert(data)).rejects.toThrow(RedisInternalError30);

        expect(mockExec).toHaveBeenCalled();
    });
});
