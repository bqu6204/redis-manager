import { redisClient } from '../../__test-setup/setup-files-after-env';
import { RedisManager } from '../../redis-manager';

let redisManager: RedisManager<any>;

beforeAll(() => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'get',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('get operations', () => {
    it('returns the value if the key-value-pair exists', async () => {
        const data1 = { key: 'exist-key', value: null };
        const data2 = { key: 'exist-key2', value: 'random' };
        await Promise.all([redisManager.add(data1), redisManager.add(data2)]);

        const result1 = await redisManager.get(data1.key);
        const result2 = await redisManager.get(data2.key);

        expect(result1).toBe(null);
        expect(result2).toBe('random');
    });

    it('returns undefined if key-value-pair does not exist', async () => {
        const data = { key: 'non-existent-key', value: null };
        const result = await redisManager.get(data.key);

        expect(result).toBe(undefined);
    });
});
