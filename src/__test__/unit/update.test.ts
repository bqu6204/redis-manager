import Redis from 'ioredis';
import { KeyNotExistError11, RedisInternalError30 } from '../../errors';
import { RedisManager } from '../../redis-manager';

let redisManager: any;
let redisClient: any;

beforeAll(() => {
    redisClient = new Redis();
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'key-value',
        maxRetries: 5,
        useRedlock: false,
    });
});

beforeEach(async () => {
    await redisManager.add({ key: 'test', value: null });
});

afterEach(async () => {
    await redisManager.clearAll();
});

afterAll(async () => {
    await redisManager.clearAll();
    await redisClient.quit();
});

describe('Update various value types to storage', () => {
    test('update object', async () => {
        const data = { key: 'test', value: { data: 'random' } };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value.data).toBe('random');
    });

    test('update null', async () => {
        const data = { key: 'test', value: null };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('update array', async () => {
        const data = { key: 'test', value: [1, 2, 3] };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual([1, 2, 3]);
    });

    test('update undefined', async () => {
        const data = { key: 'test', value: undefined };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBeNull();
    });

    test('update boolean', async () => {
        const data = { key: 'test', value: true };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(true);
    });

    test('update string', async () => {
        const data = { key: 'test', value: 'hello' };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe('hello');
    });

    test('update number', async () => {
        const data = { key: 'test', value: 42 };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toBe(42);
    });

    test('update bigint', async () => {
        const data = { key: 'test', value: BigInt(123456789) };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(BigInt(123456789));
    });

    test('update buffer', async () => {
        const data = { key: 'test', value: Buffer.from('data') };

        const result = await redisManager!.update(data);
        expect(result).toBe('OK');

        const value = await redisManager!.get(data.key);
        expect(value).toEqual(Buffer.from('data'));
    });
});

describe('Key does not exist in storage', () => {
    it('throws KeyNotExistError11 (code: 11)', async () => {
        const data = { key: 'notExist', value: null };
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

        await expect(redisManager.add(data)).rejects.toThrow(RedisInternalError30);
        expect(mockExec).toHaveBeenCalled();
    });
});

describe('Update key with expire time ', () => {
    it('Successfully udpates  ', async () => {
        const data = { key: 'test', value: Buffer.from('data') };
        const redisManager = new RedisManager({
            client: redisClient,
            namespace: 'key-value',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.update(data)).resolves.toBe('OK');
    });

    it('Fails with throwing RedisInternalError30 (code: 30)', async () => {
        const data = { key: 'test', value: Buffer.from('data') };

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
            namespace: 'key-value',
            expireMs: 10 * 1000,
            maxRetries: 5,
            useRedlock: false,
        });

        await expect(redisManager.update(data)).rejects.toThrow(RedisInternalError30);

        expect(mockExec).toHaveBeenCalled();
    });
});
