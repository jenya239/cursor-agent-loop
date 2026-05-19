import fs from 'fs';
import path from 'path';
import type { CdpTarget } from './client';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { CdpPort, CdpProbeId } from './port';

export type FixtureScenario = 'idle' | 'busy' | 'down';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as T;
}

export class FixtureCdp implements CdpPort {
  constructor(private readonly scenario: FixtureScenario = 'idle') {}

  async isAvailable(): Promise<boolean> {
    return this.scenario !== 'down';
  }

  async listTargets(): Promise<CdpTarget[]> {
    if (this.scenario === 'down') {
      throw new Error('fixture cdp unavailable');
    }
    return loadJson<CdpTarget[]>('targets.default.json');
  }

  async runProbe(probeId: CdpProbeId): Promise<ComposerAgentPageProbe[]> {
    if (probeId !== COMPOSER_AGENT_PROBE_ID) {
      throw new Error(`unknown probe: ${probeId}`);
    }
    const targets = await this.listTargets();
    const idle = loadJson('composer-idle.json');
    const busy = loadJson('composer-busy.json');

    return targets.map((t) => {
      const useBusy =
        this.scenario === 'busy' && /cr - cr - Cursor/i.test(t.title || '');
      const v = parseComposerAgentProbeValue(useBusy ? busy : idle)!;
      return { title: t.title, ...v };
    });
  }
}
