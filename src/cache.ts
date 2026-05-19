import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CacheFile<T> {
  at: number;
  data: T;
}

export function cacheDir(): string {
  return process.env.CR_CACHE_DIR || path.join(os.homedir(), '.cache', 'cr');
}

export function readCacheFile<T>(name: string): CacheFile<T> | null {
  const p = path.join(cacheDir(), name);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as CacheFile<T>;
    if (parsed?.data == null || typeof parsed.at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCacheFile<T>(name: string, data: T): void {
  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const body: CacheFile<T> = { at: Date.now(), data };
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body));
}
