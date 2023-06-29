import { Redis } from 'ioredis';

let redisClient: Redis;

beforeAll(() => {
    redisClient = new Redis();
});

afterEach(async () => {
    jest.clearAllMocks();
});

afterAll(async () => {
    // await redisClient.flushdb();
    // await redisClient.quit();
});

export { redisClient };
