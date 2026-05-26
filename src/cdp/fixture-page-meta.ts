import fs from 'fs';
import path from 'path';

export interface FixturePageMeta {
  title: string;
  hasComposer: boolean;
  activeComposerId: string | null;
}

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

let cache: FixturePageMeta[] | null = null;

export function loadFixturePageMeta(): FixturePageMeta[] {
  if (!cache) {
    cache = JSON.parse(
      fs.readFileSync(path.join(FIXTURES_DIR, 'target-pages.json'), 'utf8')
    ) as FixturePageMeta[];
  }
  return cache;
}

export function fixturePageMeta(title: string): FixturePageMeta | undefined {
  const t = title || '';
  return loadFixturePageMeta().find(
    (m) => t.includes(m.title) || m.title.includes(t)
  );
}
