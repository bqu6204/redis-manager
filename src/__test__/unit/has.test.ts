import { redisClient } from '../../__test-setup/setup-files-after-env';
import { RedisManager } from '../../redis-manager';

let redisManager: RedisManager<any>;

beforeAll(() => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'has',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('has operations', () => {
    it('return true if key exist', async () => {
        const data = { key: 'exist-key', value: null };
        await redisManager.add(data);
        const result = await redisManager.has(data.key);

        expect(result).toBe(true);
    });

    it('return false if key does not exist', async () => {
        const data = { key: 'non-existent-key', value: null };
        const result = await redisManager.has(data.key);

        expect(result).toBe(false);
    });
});
