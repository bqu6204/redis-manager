import { redisClient } from '../../__test-setup/setup-files-after-env';
import { RedisManager } from '../../redis-manager';

let redisManager: RedisManager<any>;

beforeAll(() => {
    redisManager = new RedisManager<any>({
        client: redisClient,
        namespace: 'clear-namespace',
        maxRetries: 5,
        useRedlock: false,
    });
});

afterEach(async () => {
    await redisManager.clearNamespace();
});

describe('clear-namespace operations', () => {
    it('clears all the key with the same namespace prefixed', async () => {
        const data = { key: 'exist-key', value: null };
        let exist: boolean;

        await redisManager.add(data);
        exist = await redisManager.has(data.key);
        expect(exist).toBe(true);

        await redisManager.clearNamespace();
        exist = await redisManager.has(data.key);
        expect(exist).toBe(false);
    });
});
