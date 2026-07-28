import { Injectable } from "@nestjs/common";

type CacheEntry<T> = { expiresAt: number; value: Promise<T> };

@Injectable()
export class TtlCacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const current = this.entries.get(key) as CacheEntry<T> | undefined;
    if (current && current.expiresAt > Date.now()) return current.value;

    const value = loader().catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { expiresAt: Date.now() + ttlMs, value });
    return value;
  }

  deleteByPrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  invalidateInventoryReads() {
    this.deleteByPrefix("dashboard:");
    this.deleteByPrefix("reports:");
  }

  clear() {
    this.entries.clear();
  }
}
