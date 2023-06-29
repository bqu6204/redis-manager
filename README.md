# Redis Manager

Redis Manager is a module that provides a set of methods to interact with Redis (ioredis), a popular in-memory data store. It allows you to add, update, delete, and retrieve key-value pairs in Redis.

## Installation

Since it is based on ioredis "^5.3.2", and redlock "^5.0.0-beta.2", you will need to install them:

```bash
npm install ioredis redlock
```

or

```bash
yarn add ioredis redlock
```

To install the Redis Manager module, you can use npm or yarn:

```bash
npm install @es-node/redis-manager
```

or

```bash
yarn add redis-manager
```

## Usage

```js
import { RedisManager } from 'redis-manager';
import { Redis } from 'ioredis';

// Create a Redis client instance
const redisClient = new Redis(); // Replace this with your actual Redis client instance

// Create a Redis Manager instance
const redisManager = new RedisManager({
    client: redisClient,
    expireMs: 60000, // Optional expiration time in milliseconds for keys
    namespace: 'myapp:', // The namespace prefix for keys
    maxRetries: 3, // The number of retries for failed Redis internal operations
    useRedlock: true, // Enable distributed lock management
    defaultLockTTL: 5000, // Default time-to-live (TTL) value for locks, if overtime, locks will be released.
});

// Add a key-value pair to Redis
const addResult = await redisManager.add({ key: 'mykey', value: 'myvalue', lockTTL: 2000 });
console.log(addResult); // 'OK'

// Update the value of an existing key in Redis
const updateResult = await redisManager.update({ key: 'mykey', value: 'newvalue', lockTTL: 2000 });
console.log(updateResult); // 'OK'

// Upsert a key-value pair in Redis (add if key does not exist, update if key exists)
const upsertResult = await redisManager.upsert({ key: 'mykey', value: 'upsertedvalue', lockTTL: 2000 });
console.log(upsertResult); // 'OK'

// Delete a key from Redis
const deleteResult = await redisManager.delete({ key: 'mykey', lockTTL: 2000 });
console.log(deleteResult); // true

// Check if a key exists in Redis
const hasKey = await redisManager.has('mykey');
console.log(hasKey); // false

// Retrieve the value associated with a key from Redis
const value = await redisManager.get('mykey');
console.log(value); // undefined

// Clear all keys with the specific namespace from Redis
await redisManager.clearNamespace();

// Clear all keys and their associated values from Redis
await redisManager.clearAll();
```

## API

`add({ key, value, lockTTL })`
Adds a key-value pair to Redis.

-   `key` (string): The key associated with the value.
-   `value` (any): The value to be stored.
-   `lockTTL` (number): Optional time-to-live value for locks in milliseconds.

Returns a promise that resolves to 'OK'.

Throws a KeyExistError if the key already exists.

Throws a RedisInternalError if an error occurs during the Redis operation.

`update({ key, value, lockTTL })`
Updates the value of an existing key in Redis.

-   `key` (string): The key associated with the value.
-   `value` (any): The new value to be updated.
-   `lockTTL` (number): Optional time-to-live value for locks in milliseconds.

Returns a promise that resolves to 'OK'.

Throws a KeyNotExistError if the key does not exist.

Throws a RedisInternalError if an error occurs during the Redis operation.

`upsert({ key, value, lockTTL })`
Upserts a key-value pair in Redis. If the key exists, the value is updated; otherwise, a new key-value pair is added.

-   `key` (string): The key associated with the value.
-   `value` (any): The value to be stored.
-   `lockTTL` (number): Optional time-to-live value for locks in milliseconds.

Returns a promise that resolves to 'OK'.

Throws a RedisInternalError if an error occurs during the Redis operation.

`delete(key)`
Deletes a key-value pair from Redis.

-   `key` (string): The key to delete.

Returns a promise that resolves to the number of keys deleted (0 or 1).

Throws a RedisInternalError if an error occurs during the Redis operation.

`get(key)`
Retrieves the value associated with a key from Redis.

-   `key` (string): The key to retrieve the value for.

Returns a promise that resolves to the value associated with the key, or null if the key does not exist.

Throws a RedisInternalError if an error occurs during the Redis operation.

`has(key)`
Checks if a key exists in Redis.

-   `key` (string): The key to check.

Returns a promise that resolves to true if the key exists, or false if it does not exist.

Throws a RedisInternalError if an error occurs during the Redis operation.

`clearNamespace()`
Clears all keys associated with the current namespace from Redis.

Returns a promise that resolves to the number of keys deleted.

Throws a RedisInternalError if an error occurs during the Redis operation.

`clearAll()`
Clears all keys from Redis.

Returns a promise that resolves to the number of keys deleted.

Throws a RedisInternalError if an error occurs during the Redis operation.

`namespace` (string): The namespace to use.

Returns the current instance of the Redis client for method chaining.

## Contributing

Contributions to the Redis Manager project are welcome! If you find a bug, have suggestions for improvements, or want to add new features, feel free to open an issue or submit a pull request on the <u>GitHub repository</u>.

## License

The Redis Manager project is licensed under the <u>ISC License</u>.
