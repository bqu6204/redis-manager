import { Redis } from 'ioredis';
import Redlock, { Settings } from 'redlock';
import { KeyExistError10, KeyNotExistError11, RedisInternalError30 } from './errors';
import { CustomError } from './errors/core/_custom-error';
import { PrefixHandler } from './handler-prefix';

/**
 * Represents a key-value pair with an optional time-to-live (TTL) value.
 */
type TInputKeyValueWithTTL<V> = {
    key: string; // The key associated with the value.
    value: V extends null ? never : NonNullable<V>; // The value associated with the key. Cannot be null.
    ttl?: number; // Optional time-to-live value in milliseconds.
};

type TOutputKeyValue<V> = {
    key: string;
    value: V extends null ? null : V;
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
    add({ key, value, ttl }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>>;

    /**
     * Updates the value of an existing key in Redis.
     *
     * @param key The key associated with the value.
     * @param value The new value to be updated.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to the updated key-value pair.
     * @throws An error if the value is undefined or if the key does not exist.
     */
    update({ key, value, ttl }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>>;

    /**
     * Upserts a key-value pair in Redis. If the key exists, the value is updated; otherwise, a new key-value pair is added.
     *
     * @param key The key associated with the value.
     * @param value The value to be stored.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to the upserted key-value pair.
     * @throws An error if the value is undefined.
     */
    upsert({ key, value, ttl }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>>;

    /**
     * Deletes a key and its associated value from Redis.
     *
     * @param key The key to be deleted.
     * @param ttl Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to true if the key was deleted successfully, false otherwise.
     */
    delete({ key, ttl }: TInputKeyValueWithTTL<V>): Promise<boolean>;

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
    maxRetries: number; // The number of retries for failed Redis internal operations.
    redlockConfig?: Partial<Settings>; // Optional configuration for Redlock distributed lock.
}

/**
 * RedisManager provides a set of methods to interact with Redis.
 * @template V The type of values stored in Redis.
 */
class RedisManger<V> implements IRedisManager<V> {
    private readonly _client: Redis; // The Redis client instance.
    private readonly _namespace: string; // The namespace prefix for keys.
    private readonly _expireMs?: number; // Optional expiration time in milliseconds for keys.
    private readonly _defaultTTL: number; // The default time-to-live (TTL) value for keys.
    private readonly _prefixHandler: PrefixHandler; // The prefix handler for key namespacing.
    private readonly _redlock: Redlock; // The distributed lock manager.
    private readonly _maxRetries: number;

    /**
     * Creates an instance of RedisManager.
     * @param config The configuration options for the RedisManager.
     */
    constructor({ client, expireMs, namespace, defaultTTL, redlockConfig, maxRetries }: IRedisManangerConfig) {
        this._client = client;
        this._expireMs = expireMs;
        this._namespace = namespace;
        this._defaultTTL = defaultTTL;

        this._maxRetries = maxRetries;
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

    async add({ key, value, ttl = this._defaultTTL }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);

            const exist = await this._client.exists(prefixedKey);
            if (exist) {
                throw new KeyExistError10(`Key ${key} already exists.`);
            }
            const pipeline = this._client.pipeline().set(prefixedKey, value ?? null, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;
            while (retries >= 0) {
                try {
                    await pipeline.exec();
                } catch (error) {
                    if (retries === 0) {
                        throw new RedisInternalError30(
                            `Failed to add key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                            error
                        );
                    }
                    retries--;
                }
            }
            return { key, value: value ?? null };
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new RedisInternalError30(
                `Failed to add key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                error
            );
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    throw new RedisInternalError30(
                        `Error occurred after updating key:${key} while releasing the lock:`,
                        error
                    );
                }
            }
        }
    }

    async update({ key, value, ttl = this._defaultTTL }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);

            const exist = await this._client.exists(prefixedKey);
            if (!exist) {
                throw new KeyNotExistError11(`Key ${key} does not exist.`);
            }
            const pipeline = this._client.pipeline().set(prefixedKey, value ?? null, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;
            while (retries >= 0) {
                try {
                    await pipeline.exec();
                } catch (error) {
                    if (retries === 0) {
                        throw new RedisInternalError30(
                            `Failed to update key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                            error
                        );
                    }
                    retries--;
                }
            }
            return { key, value: value ?? null };
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new RedisInternalError30(
                `Failed to update key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                error
            );
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    throw new RedisInternalError30(
                        `Error occurred after adding key:${key} while releasing the lock:`,
                        error
                    );
                }
            }
        }
    }

    async upsert({ key, value, ttl = this._defaultTTL }: TInputKeyValueWithTTL<V>): Promise<TOutputKeyValue<V>> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);

            const pipeline = this._client.pipeline().set(prefixedKey, value ?? null, 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;
            while (retries >= 0) {
                try {
                    await pipeline.exec();
                } catch (error) {
                    if (retries === 0) {
                        throw new RedisInternalError30(
                            `Failed to upsert key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                            error
                        );
                    }
                    retries--;
                }
            }
            return { key, value: value ?? null };
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new RedisInternalError30(
                `Failed to upsert key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                error
            );
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    throw new RedisInternalError30(
                        `Error occurred after upserting key:${key} while releasing the lock:`,
                        error
                    );
                }
            }
        }
    }

    async delete({ key, ttl = this._defaultTTL }: TInputKeyValueWithTTL<V>): Promise<boolean> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = await this._redlock.acquire(['lock:' + prefixedKey], ttl);

            let retries = this._maxRetries;
            let result;
            while (retries >= 0) {
                try {
                    result = await this._client.del(prefixedKey);
                } catch (error) {
                    if (retries === 0) {
                        throw new RedisInternalError30(`Failed to delete key:${key} in Redis`, error);
                    }
                    retries--;
                }
            }
            return result === 1;
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new RedisInternalError30(`Failed to delete key:${key} in Redis`, error);
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (error) {
                    throw new RedisInternalError30(
                        `Error occurred after deleting key:${key} while releasing the lock:`,
                        error
                    );
                }
            }
        }
    }

    async has(key: string): Promise<boolean> {
        const prefixedKey = this._prefixHandler.concat(key);
        let retries = this._maxRetries;
        while (retries >= 0) {
            try {
                const exists = await this._client.exists(prefixedKey);
                return exists === 1; // Return true if the key exists
            } catch (error) {
                if (retries === 0) {
                    throw new RedisInternalError30(`Failed to check existence of key ${prefixedKey} in Redis`, error);
                }
                retries--;
            }
        }

        return false; // Return false indicating failure
    }

    async get(key: string): Promise<V | undefined> {
        const prefixedKey = this._prefixHandler.concat(key);

        let retries = this._maxRetries;
        while (retries >= 0) {
            try {
                const exists = await this._client.exists(prefixedKey);
                if (!exists) return undefined;

                const value = (await this._client.get(prefixedKey)) as V;
                return value;
            } catch (error) {
                if (retries === 0) {
                    throw new RedisInternalError30(`Failed to retrieve value for key ${prefixedKey} from Redis`, error);
                }
                retries--;
            }
        }

        return undefined; // Return undefined indicating failure
    }

    async clearAll(): Promise<void> {
        let retries = this._maxRetries;
        while (retries >= 0) {
            try {
                await this._client.flushdb();
                return; // Return early if successful
            } catch (error) {
                if (retries === 0) {
                    throw new RedisInternalError30('Failed to clear all keys in Redis', error);
                }
                retries--;
            }
        }
    }
}

export { RedisManger };
