import { Redis } from 'ioredis';
import Redlock, { Settings } from 'redlock';
import { PrefixHandler } from './handler-prefix';

/**
 * Represents a key-value pair with an optional time-to-live (TTL) value.
 */
type TKeyValueWithTTL<V> = {
    key: string; // The key associated with the value.
    value: V extends null ? never : V; // The value associated with the key. Cannot be null.
    ttl?: number; // Optional time-to-live value in milliseconds.
};

/**
 * Represents a Redis manager interface.
 *
 * @template V The type of values stored in Redis.
 */
interface IRedisManager<V> {
    /**
     * Adds a key-value pair to Redis.
     *
     * @param key The key associated with the value.
     * @param value The value to be stored.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to the added key-value pair.
     * @throws An error if the value is undefined.
     */
    add({ key, value, ttl }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>>;

    /**
     * Updates the value of an existing key in Redis.
     *
     * @param key The key associated with the value.
     * @param value The new value to be updated.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to the updated key-value pair.
     * @throws An error if the value is undefined or if the key does not exist.
     */
    update({ key, value, ttl }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>>;

    /**
     * Upserts a key-value pair in Redis. If the key exists, the value is updated; otherwise, a new key-value pair is added.
     *
     * @param key The key associated with the value.
     * @param value The value to be stored.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to the upserted key-value pair.
     * @throws An error if the value is undefined.
     */
    upsert({ key, value, ttl }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>>;

    /**
     * Deletes a key and its associated value from Redis.
     *
     * @param key The key to be deleted.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to true if the key was deleted successfully, false otherwise.
     */
    delete({ key, ttl }: TKeyValueWithTTL<V>): Promise<boolean>;

    /**
     * Checks if a key exists in Redis.
     *
     * @param key The key to check for existence.
     * @returns A promise that resolves to true if the key exists, false otherwise.
     */
    has(key: string): Promise<boolean>;

    /**
     * Retrieves the value associated with a key from Redis.
     *
     * @param key The key to retrieve the value for.
     * @returns A promise that resolves to the value associated with the key, or undefined if the key does not exist.
     */
    get(key: string): Promise<V | undefined>;

    /**
     * Clears all keys and their associated values from Redis.
     *
     * @returns A promise that resolves when all keys are cleared.
     */
    clearAll(): Promise<void>;
}

/**
 * Configuration options for the RedisManager.
 */
interface IRedisManangerConfig {
    client: Redis; // The Redis client instance.
    expireMs?: number; // Optional expiration time in milliseconds for keys.
    namespace: string; // The namespace prefix for keys.
    defaultTTL: number; // The default time-to-live (TTL) value for keys.
    redlockConfig?: Partial<Settings>; // Optional configuration for Redlock distributed lock.
}

/**
 * RedisManager provides a set of methods to interact with Redis.
 * @template V The type of values stored in Redis.
 */
class RedisManger<V extends null | Exclude<undefined, V>> implements IRedisManager<V> {
    private readonly _client: Redis; // The Redis client instance.
    private readonly _namespace: string; // The namespace prefix for keys.
    private readonly _expireMs?: number; // Optional expiration time in milliseconds for keys.
    private readonly _defaultTTL: number; // The default time-to-live (TTL) value for keys.
    private readonly _prefixHandler: PrefixHandler; // The prefix handler for key namespacing.
    private readonly _redlock: Redlock; // The distributed lock manager.

    /**
     * Creates an instance of RedisManager.
     * @param config The configuration options for the RedisManager.
     */
    constructor({ client, expireMs, namespace, defaultTTL, redlockConfig }: IRedisManangerConfig) {
        this._client = client;
        this._expireMs = expireMs;
        this._namespace = namespace;
        this._defaultTTL = defaultTTL;
        this._prefixHandler = new PrefixHandler({ namespace });
        this._redlock = new Redlock([this._client], redlockConfig);
    }

    /**
     * Gets the namespace used for key namespacing.
     * @returns The namespace string.
     */
    get namespace() {
        return this._namespace;
    }

    /**
     * Gets the expiration time in milliseconds for keys.
     * @returns The expiration time in milliseconds.
     */
    get expireMs() {
        return this._expireMs;
    }

    /**
     * Handles errors by logging the error message and throwing an error.
     * @param message - The error message.
     * @param error - The error object (optional).
     * @throws The error object, if provided, or a new Error with the specified message.
     */
    private handleError(message: string, error?: unknown) {
        console.error(message, error ?? '');
        if (error) throw error;
        throw new Error(message);
    }

    async add({ key, value, ttl = this._defaultTTL }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>> {
        if (typeof value === 'undefined') {
            throw this.handleError(`Value cannot be undefined for key ${key}.`);
        }
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);
            const exist = await this._client.exists(prefixedKey);
            if (exist) throw new Error(`Key ${key} already exists.`);

            const pipeline = this._client.pipeline().set(prefixedKey, value, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }
            await pipeline.exec();
        } catch (error) {
            this.handleError(`Failed to add key-value pair ${JSON.stringify({ key: value })} in Redis`, error);
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    this.handleError('Error occurred while releasing the lock:', error);
                }
            }
        }
        return { key, value, ttl };
    }

    async update({ key, value, ttl = this._defaultTTL }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>> {
        if (typeof value === 'undefined') {
            throw this.handleError(`Value cannot be undefined for key ${key}.`);
        }
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);
            const exists = await this._client.exists(prefixedKey);
            if (!exists) {
                throw new Error(`Key ${prefixedKey} does not exist.`);
            }

            const pipeline = this._client.pipeline().set(prefixedKey, value, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }
            await pipeline.exec();
        } catch (error) {
            this.handleError(`Failed to update key-value pair ${JSON.stringify({ key: value })} in Redis`, error);
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    this.handleError('Error occurred while releasing the lock:', error);
                }
            }
        }
        return { key, value, ttl };
    }

    async upsert({ key, value, ttl = this._defaultTTL }: TKeyValueWithTTL<V>): Promise<TKeyValueWithTTL<V>> {
        if (typeof value === 'undefined') {
            throw this.handleError(`Value cannot be undefined for key ${key}.`);
        }
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);
            const pipeline = this._client.pipeline().set(prefixedKey, value, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }
            await pipeline.exec();
        } catch (error) {
            this.handleError(`Failed to upsert key-value pair ${JSON.stringify({ key: value })} in Redis`, error);
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    this.handleError('Error occurred while releasing the lock:', error);
                }
            }
        }

        return { key, value, ttl };
    }

    async delete({ key, ttl = this._defaultTTL }: TKeyValueWithTTL<V>): Promise<boolean> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);
            const deleteResult = await this._client.del(prefixedKey);
            return deleteResult === 1; // Return true if the key was deleted successfully
        } catch (error) {
            this.handleError(`Failed to delete key ${prefixedKey} from Redis`, error);
            return false; // Return false indicating deletion failure
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    this.handleError('Error occurred while releasing the lock:', error);
                }
            }
        }
    }

    async has(key: string): Promise<boolean> {
        const prefixedKey = this._prefixHandler.concat(key);

        try {
            const exists = await this._client.exists(prefixedKey);
            return exists === 1; // Return true if the key exists
        } catch (error) {
            this.handleError(`Failed to check existence of key ${prefixedKey} in Redis`, error);
            return false; // Return false indicating failure
        }
    }

    async get(key: string): Promise<V | undefined> {
        const prefixedKey = this._prefixHandler.concat(key);
        try {
            const exists = await this._client.exists(prefixedKey);
            if (!exists) return undefined;

            const value = (await this._client.get(prefixedKey)) as V;
            return value;
        } catch (error) {
            this.handleError(`Failed to retrieve value for key ${prefixedKey} from Redis`, error);
        }
    }

    async clearAll(): Promise<void> {
        try {
            await this._client.flushdb();
        } catch (error) {
            this.handleError('Failed to clear all keys in Redis', error);
        }
    }
}

export { RedisManger };
