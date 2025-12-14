/**
 * Lightweight in-memory cache with TTL
 * LRU eviction policy
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * LRU Cache implementation with TTL
 */
class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 30 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Research data cache
 * Cache key format: research::<manufacturer>::<model>::<year>::<description-hash>
 */
import type { ResearchData } from "./types";

const researchCache = new LRUCache<string, ResearchData>(100, 30 * 60 * 1000); // 30 minutes TTL

/**
 * Generate cache key for research data
 */
export function generateCacheKey(
  manufacturer: string,
  model: string,
  year: number | null | undefined,
  description: string
): string {
  // Create a simple hash of the description (first 50 chars + length)
  const descHash = description
    .slice(0, 50)
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "") + "_" + description.length;

  return `research::${manufacturer}::${model}::${year || "unknown"}::${descHash}`;
}

/**
 * Get cached research data
 */
export function getCachedResearch(key: string): ResearchData | null {
  return researchCache.get(key);
}

/**
 * Set cached research data
 */
export function setCachedResearch(key: string, data: ResearchData): void {
  researchCache.set(key, data);
}

/**
 * Clear research cache (useful for testing)
 */
export function clearResearchCache(): void {
  researchCache.clear();
}

