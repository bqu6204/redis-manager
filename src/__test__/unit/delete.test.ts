import { redisClient } from '../../__test-setup/setup-files-after-env';
import { RedisManager } from '../../redis-manager';

let redisManager: RedisManager<any>;

beforeAll(() => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'delete',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('delete operations', () => {
    it('deletes an existing key, and return true', async () => {
        const data = { key: 'exist-key', value: null };
        await redisManager.add(data);
        const result = await redisManager.delete({ key: data.key });

        expect(result).toBe(true);
    });

    it('deletes a non-existent key, and return false', async () => {
        const data = { key: 'non-existent-key', value: null };
        const result = await redisManager.delete({ key: data.key });

        expect(result).toBe(false);
    });
});
