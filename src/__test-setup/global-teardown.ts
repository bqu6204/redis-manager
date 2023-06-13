import { Redis } from 'ioredis';

module.exports = async function () {
    delete global.keyValueStorage;
    delete global.keyOnlyStorage;

    await (global.redisClient as Redis).quit();
    delete global.redisClient;
};
