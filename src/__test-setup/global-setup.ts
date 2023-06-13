import { Redis } from 'ioredis';
import { RedisManager } from '../redis-manager';

declare global {
    var keyValueStorage: RedisManager<any> | undefined;
    var keyOnlyStorage: RedisManager<null> | undefined;
    var redisClient: Redis | undefined;
}

module.exports = async () => {
    global.redisClient = new Redis();
    global.keyValueStorage = new RedisManager({
        client: global.redisClient,
        namespace: 'key-value',
        expireMs: 10 * 1000,
        defaultLockTTL: 5 * 1000,
        maxRetries: 5,
        redlockConfig: {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 200,
            retryJitter: 200,
            automaticExtensionThreshold: 500,
        },
    });

    global.keyOnlyStorage = new RedisManager({
        client: global.redisClient,
        namespace: 'key-only',
        expireMs: 10 * 1000,
        defaultLockTTL: 5 * 1000,
        maxRetries: 5,
        redlockConfig: {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 200,
            retryJitter: 200,
            automaticExtensionThreshold: 500,
        },
    });
};
