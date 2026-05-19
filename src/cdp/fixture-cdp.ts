import fs from 'fs';
import path from 'path';
import type { CdpTarget } from './client';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { CdpPort, CdpSendResult } from './port';

export type FixtureScenario =
  | 'idle'
  | 'busy'
  | 'down'
  | 'no-bar'
  | 'send-blocked'
  | 'switch-fail'
  | 'switch-ok';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as T;
}

const NO_BAR = { busy: false, reason: 'no-bar' as const };

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

  async runProbe(probeId: typeof COMPOSER_AGENT_PROBE_ID): Promise<ComposerAgentPageProbe[]> {
    if (probeId !== COMPOSER_AGENT_PROBE_ID) {
      throw new Error(`unknown probe: ${probeId}`);
    }
    const targets = await this.listTargets();
    const idle = loadJson('composer-idle.json');
    const busy = loadJson('composer-busy.json');

    return targets.map((t) => {
      if (this.scenario === 'no-bar') {
        return { title: t.title, ...NO_BAR };
      }
      const useBusy =
        (this.scenario === 'busy' || this.scenario === 'send-blocked') &&
        /cr - cr - Cursor/i.test(t.title || '');
      const v = parseComposerAgentProbeValue(useBusy ? busy : idle)!;
      return { title: t.title, ...v };
    });
  }

  async switchComposer(
    _composerId: string,
    opts?: { windowTitle?: string; chatName?: string }
  ): Promise<{ ok: boolean; reason: string; switchTarget?: string }> {
    if (this.scenario === 'switch-fail') {
      return { ok: false, reason: 'no-element' };
    }
    if (this.scenario === 'switch-ok') {
      return { ok: true, reason: 'history-name', switchTarget: opts?.windowTitle || 'fixture-window' };
    }
    return { ok: true, reason: 'fixture-skip' };
  }

  async sendMessage(
    text: string,
    opts?: { windowTitle?: string; allowBusy?: boolean }
  ): Promise<CdpSendResult> {
    if (this.scenario === 'down') throw new Error('cdp unavailable');
    if (this.scenario === 'no-bar') throw new Error('composer no-bar');
    if (this.scenario === 'send-blocked' && !opts?.allowBusy) {
      throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
    }
    const targets = await this.listTargets();
    const page = targets.find((t) => /cr - cr - Cursor/i.test(t.title || '')) || targets[0];
    return { ok: true, text, pageTitle: page?.title || 'fixture' };
  }
}
