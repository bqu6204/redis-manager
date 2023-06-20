import { Redis } from 'ioredis';
import Redlock, { Settings } from 'redlock';
import { KeyExistError10, KeyNotExistError11, RedisInternalError30, UnknownInternalError50 } from './errors';
import { CustomError } from './errors/core/_custom-error';
import { JSONHandler } from './handler-json';
import { PrefixHandler } from './handler-prefix';

/**
 * Represents the input parameters for adding a key-value pair with an optional time-to-live (TTL) value.
 */
type TInputKeyValueWithLockTTL<V> = {
    key: string; // The key associated with the value.
    value: V; // The value associated with the key. Cannot be null.
    lockTTL?: number; // Optional time-to-live value in milliseconds.
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
     * @param lockTTL Optional time-to-live value in milliseconds.
     * @returns A promise that resolves 'OK'.
     * @throws KeyExistError10 if the key already exists.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    add({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'>;
    /**
     * Updates the value of an existing key in Redis.
     *
     * @param key The key associated with the value.
     * @param value The new value to be updated.
     * @param lockTTL Optional time-to-live value in milliseconds.
     * @returns A promise that resolves 'OK'.
     * @throws KeyNotExistError11 if the key does not exist.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    update({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'>;

    /**
     * Upserts a key-value pair in Redis. If the key exists, the value is updated; otherwise, a new key-value pair is added.
     *
     * @param key The key associated with the value.
     * @param value The value to be stored.
     * @param lockTTL Optional time-to-live value in milliseconds.
     * @returns A promise that resolves 'OK'.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    upsert({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'>;

    /**
     * Deletes a key and its associated value from Redis.
     *
     * @param key The key to be deleted.
     * @param lockTTL Optional time-to-live value in milliseconds.
     * @returns A promise that resolves to true if the key was deleted successfully, false otherwise.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    delete({ key, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<boolean>;

    /**
     * Checks if a key exists in Redis.
     *
     * @param key The key to check for existence.
     * @returns A promise that resolves to true if the key exists, false otherwise.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    has(key: string): Promise<boolean>;

    /**
     * Retrieves the value associated with a key from Redis.
     *
     * @param key The key to retrieve the value for.
     * @returns A promise that resolves to the value associated with the key, or undefined if the key does not exist.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    get(key: string): Promise<V | undefined>;

    /**
     * Clears all keys and their associated values from Redis.
     *
     * @returns A promise that resolves when all keys are cleared.
     * @throws RedisInternalError30 if an error occurs during the Redis operation.
     */
    clearAll(): Promise<void>;
}

/**
 * Configuration options for the RedisManager.
 */

type TRedisManagerConfig =
    | {
          client: Redis; // The Redis client instance.
          expireMs?: number; // Optional expiration time in milliseconds for keys.
          namespace: string; // The namespace prefix for keys.
          maxRetries: number; // The number of retries for failed Redis internal operations.
          useRedlock: false;
      }
    | {
          client: Redis; // The Redis client instance.
          expireMs?: number; // Optional expiration time in milliseconds for keys.
          namespace: string; // The namespace prefix for keys.
          maxRetries: number; // The number of retries for failed Redis internal operations.
          useRedlock: true;
          defaultLockTTL: number;
          redlockConfig?: Partial<Settings>;
      };

/**
 * RedisManager provides a set of methods to interact with Redis.
 * @template V The type of values stored in Redis.
 */
class RedisManager<V> implements IRedisManager<V> {
    private readonly _client: Redis; // The Redis client instance.
    private readonly _namespace: string; // The namespace prefix for keys.
    private readonly _expireMs?: number; // Optional expiration time in milliseconds for keys.
    private readonly _maxRetries: number; // The number of retries for failed Redis internal operations.
    private readonly _JSONHandler: JSONHandler<V>;
    private readonly _prefixHandler: PrefixHandler; // The prefix handler for key namespacing.
    private readonly _redlock?: Redlock; // The distributed lock manager.
    private readonly _defaultLockTTL?: number; // The default time-to-live (TTL) value for keys.

    /**
     * Creates an instance of RedisManager.
     * @param config The configuration options for the RedisManager.
     */
    constructor(props: TRedisManagerConfig) {
        this._client = props.client;
        this._expireMs = props.expireMs;
        this._namespace = props.namespace;
        this._maxRetries = props.maxRetries;

        this._JSONHandler = new JSONHandler();
        this._prefixHandler = new PrefixHandler({ namespace: props.namespace });

        if (props.useRedlock) {
            this._redlock = new Redlock([this._client], props.redlockConfig);
            this._defaultLockTTL = props.defaultLockTTL;
        }
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

    async add({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = this._redlock
                ? await this._redlock.acquire(['lock:' + prefixedKey], lockTTL || this._defaultLockTTL!)
                : null;
            const pipeline = this._client.pipeline().set(prefixedKey, this._JSONHandler.serialize(value), 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;

            do {
                try {
                    const result = await pipeline.exec();
                    if (!result)
                        throw new RedisInternalError30(
                            `Failed to add key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`
                        );

                    // ioredis doc :
                    // The resolve to pipline.exec() will look like
                    //   [[ null, <<return value 1>> ], [ null, <<return value 2>> ], ...].
                    // Every [n][0] will be set to null, and [n][1] is the return value.

                    console.log('Result: ', result);

                    if (result[0][1] !== 'OK') throw new KeyExistError10(`Key ${key} already exists.`);
                    if (this._expireMs && !result[1][1])
                        throw new RedisInternalError30(`Failed to add expire ms when adding key ${key} in Redis`);
                    return 'OK';
                } catch (error) {
                    console.log(error);
                    if (error instanceof KeyExistError10) throw error;
                    if (retries === 0) {
                        if (error instanceof CustomError) throw error;
                        throw new UnknownInternalError50(
                            `Unhandled Error occurs in runtime when adding key-value pair ${JSON.stringify({
                                key,
                                value: value ?? null,
                            })} .`,
                            error
                        );
                    }
                    retries--;
                }
            } while (retries >= 0);
            throw new UnknownInternalError50(
                "This error shouldn't have occured , please check the add method in Redis Manager class."
            );
        } catch (error) {
            if (error instanceof CustomError) throw error;

            throw new UnknownInternalError50(
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

    async update({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;
        try {
            lock = this._redlock
                ? await this._redlock.acquire(['lock:' + prefixedKey], lockTTL || this._defaultLockTTL!)
                : null;

            const pipeline = this._client.pipeline().set(prefixedKey, this._JSONHandler.serialize(value), 'XX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;
            do {
                try {
                    const result = await pipeline.exec();
                    if (!result)
                        throw new RedisInternalError30(
                            `Failed to update key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`
                        );
                    if (result[0][1] !== 'OK') throw new KeyNotExistError11(`Key ${key} does not exist`);
                    if (this._expireMs && !result[1][1])
                        throw new RedisInternalError30(`Failed to refresh expire ms when udpating key ${key} in Redis`);

                    return 'OK';
                } catch (error) {
                    if (error instanceof KeyNotExistError11) throw error;
                    if (retries === 0) {
                        if (error instanceof CustomError) throw error;
                        throw new RedisInternalError30(
                            `Failed to update key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                            error
                        );
                    }
                    retries--;
                }
            } while (retries >= 0);
            throw new UnknownInternalError50(
                "This error shouldn't have occured , please check the update method in Redis Manager class ."
            );
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

    async upsert({ key, value, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<'OK'> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = this._redlock
                ? await this._redlock.acquire(['lock:' + prefixedKey], lockTTL || this._defaultLockTTL!)
                : null;

            const pipeline = this._client.pipeline().set(prefixedKey, this._JSONHandler.serialize(value), 'NX');
            if (this._expireMs) {
                pipeline.pexpire(prefixedKey, this._expireMs);
            }

            let retries = this._maxRetries;
            while (retries >= 0) {
                try {
                    const result = await pipeline.exec();
                    if (!result)
                        throw new RedisInternalError30(
                            `Failed to upsert key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`
                        );
                    if (this._expireMs && !result[1][1])
                        throw new RedisInternalError30(`Failed to refresh expire ms when udpating key ${key} in Redis`);

                    return 'OK';
                } catch (error) {
                    if (retries === 0) {
                        if (error instanceof CustomError) throw error;
                        throw new RedisInternalError30(
                            `Failed to upsert key-value pair ${JSON.stringify({ key, value: value ?? null })} in Redis`,
                            error
                        );
                    }
                    retries--;
                }
            }

            throw new UnknownInternalError50(
                "This error shouldn't have occured , please check the upsert method in Redis Manager class ."
            );
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

    async delete({ key, lockTTL }: TInputKeyValueWithLockTTL<V>): Promise<boolean> {
        const prefixedKey = this._prefixHandler.concat(key);
        let lock;

        try {
            lock = this._redlock
                ? await this._redlock.acquire(['lock:' + prefixedKey], lockTTL || this._defaultLockTTL!)
                : null;

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
                const value = await this._client.get(prefixedKey);
                if (!value) return undefined;

                return this._JSONHandler.parse(value);
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

export { RedisManager, TInputKeyValueWithLockTTL, IRedisManager, TRedisManagerConfig };
