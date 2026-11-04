/**
 * Adapts validated session data to secure native storage or browser memory.
 * The storage boundary keeps persistence choices out of individual screens.
 */
import { tokenSchema, type TokenPair } from "@mystreetvendor/shared-types";
import type { SessionStore } from "./index";

export interface StorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createSessionStore(
  driver: StorageDriver | null,
  key: string,
): SessionStore {
  // A browser preview deliberately has no persistent bearer/refresh storage.
  let memory: TokenPair | null = null;
  return {
    async read() {
      if (!driver) return memory;
      const raw = await driver.getItem(key);
      if (raw === null) return null;
      try {
        return tokenSchema.parse(JSON.parse(raw));
      } catch {
        await driver.removeItem(key);
        return null;
      }
    },
    async write(tokens) {
      const valid = tokenSchema.parse(tokens);
      if (driver) await driver.setItem(key, JSON.stringify(valid));
      else memory = valid;
    },
    async clear() {
      memory = null;
      if (driver) await driver.removeItem(key);
    },
  };
}
