import fs from 'fs';
import path from 'path';
import { composerPageOrder, type CdpTarget } from './client';
import { fixturePageMeta } from './fixture-page-meta';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { ActiveComposer } from './active-composer';
import { composerIdsMatch, filterTargetsByHints } from './window-match';
import type { CdpPort, CdpSendResult, DismissOutcome } from './port';

const FIXTURE_ACTIVE_COMPOSER = '11111111-1111-1111-1111-111111111111';
const FIXTURE_BUSY_COMPOSER = '33333333-3333-3333-3333-333333333333';
const FIXTURE_MLC_COMPOSER = 'f8e0a645-1610-4a1e-b19f-63f502235a2e';
const FIXTURE_NORD_COMPOSER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export function fixtureActiveIdForWindow(windowTitle: string, composerId: string): string | null {
  const meta = fixturePageMeta(windowTitle);
  if (meta?.activeComposerId && composerIdsMatch(meta.activeComposerId, composerId)) {
    return meta.activeComposerId;
  }
  if (/cr - cr/i.test(windowTitle) && composerId === FIXTURE_BUSY_COMPOSER) {
    return FIXTURE_BUSY_COMPOSER;
  }
  return null;
}

export type FixtureScenario =
  | 'idle'
  | 'busy'
  | 'down'
  | 'no-bar'
  | 'send-blocked'
  | 'switch-fail'
  | 'switch-ok'
  | 'switch-unverified'
  | 'modal-revert';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as T;
}

const NO_BAR = { busy: false, reason: 'no-bar' as const };

export function isFixtureCdp(cdp: CdpPort): cdp is FixtureCdp {
  return (cdp as { isFixture?: boolean }).isFixture === true;
}

export class FixtureCdp implements CdpPort {
  readonly isFixture = true;
  private modalOpen: boolean;

  constructor(private readonly scenario: FixtureScenario = 'idle') {
    this.modalOpen = scenario === 'modal-revert';
  }

  async isAvailable(): Promise<boolean> {
    return this.scenario !== 'down';
  }

  async listTargets(): Promise<CdpTarget[]> {
    if (this.scenario === 'down') {
      throw new Error('fixture cdp unavailable');
    }
    return loadJson<CdpTarget[]>('targets.default.json');
  }

  pageHasComposer(page: CdpTarget): boolean {
    return fixturePageMeta(page.title || '')?.hasComposer ?? false;
  }

  async runProbe(probeId: typeof COMPOSER_AGENT_PROBE_ID): Promise<ComposerAgentPageProbe[]> {
    if (probeId !== COMPOSER_AGENT_PROBE_ID) {
      throw new Error(`unknown probe: ${probeId}`);
    }
    const targets = await this.listTargets();
    const idle = loadJson('composer-idle.json');
    const busy = loadJson('composer-busy.json');

    return targets.map((t) => {
      if (this.scenario === 'no-bar' || !this.pageHasComposer(t)) {
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
    composerId: string,
    opts?: { windowTitle?: string; chatName?: string; workspaceHints?: string[] }
  ): Promise<{ ok: boolean; reason: string; switchTarget?: string }> {
    if (this.scenario === 'switch-fail') {
      return { ok: false, reason: 'no-element' };
    }

    if (this.scenario === 'switch-unverified') {
      const targets = await this.listTargets();
      const nord = targets.find((t) => /nord/i.test(t.title || ''));
      return {
        ok: true,
        reason: 'active-tab',
        switchTarget: nord?.title || 'schema.json - nord (Workspace) - Cursor',
      };
    }

    let targets = await this.listTargets();
    const hints = opts?.workspaceHints ?? [];
    if (hints.length) {
      const filtered = filterTargetsByHints(targets, hints);
      if (!filtered.length) return { ok: false, reason: 'workspace-window-not-found' };
      targets = filtered;
    }

    for (const page of composerPageOrder(targets)) {
      if (!this.pageHasComposer(page)) continue;
      const title = page.title || '';
      if (fixtureActiveIdForWindow(title, composerId)) {
        return { ok: true, reason: 'verified', switchTarget: title };
      }
    }

    const wrong = composerPageOrder(targets).find((p) => this.pageHasComposer(p));
    return {
      ok: false,
      reason: 'switch-mismatch',
      switchTarget: wrong?.title,
    };
  }

  getActiveComposer(): ActiveComposer | null {
    const targets = loadJson<CdpTarget[]>('targets.default.json');
    for (const page of composerPageOrder(targets)) {
      if (!this.pageHasComposer(page)) continue;
      const meta = fixturePageMeta(page.title || '');
      if (meta?.activeComposerId) {
        return {
          composerId: meta.activeComposerId,
          windowTitle: page.title || '',
          reason: 'fixture',
        };
      }
    }
    return null;
  }

  async sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult> {
    if (this.scenario === 'down') throw new Error('cdp unavailable');
    if (this.scenario === 'no-bar') throw new Error('composer no-bar');
    if (this.scenario === 'send-blocked') {
      throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
    }
    const targets = await this.listTargets();
    const page = opts?.windowTitle
      ? targets.find((t) => (t.title || '').includes(opts.windowTitle!))
      : targets.find((t) => /cr - cr - Cursor/i.test(t.title || '')) || targets[0];
    return { ok: true, text, pageTitle: page?.title || 'fixture' };
  }

  async probeActive(): Promise<ActiveComposer | null> {
    return this.getActiveComposer();
  }

  async findWindowForComposer(
    composerId: string,
    opts?: { workspaceHints?: string[] }
  ): Promise<ActiveComposer | null> {
    const targets = await this.listTargets();
    let pages = composerPageOrder(targets);
    const hints = opts?.workspaceHints ?? [];
    if (hints.length) {
      const hinted = filterTargetsByHints(targets, hints);
      const rest = targets.filter((t) => !hinted.some((h) => h.id === t.id));
      if (hinted.length) pages = composerPageOrder([...hinted, ...rest]);
    }
    for (const page of pages) {
      if (!this.pageHasComposer(page)) continue;
      const id = fixtureActiveIdForWindow(page.title || '', composerId);
      if (id) {
        return { composerId: id, windowTitle: page.title || '', reason: 'fixture-bar' };
      }
    }
    return null;
  }

  async dismissModals(): Promise<DismissOutcome[]> {
    if (this.scenario !== 'modal-revert' || !this.modalOpen) return [];
    this.modalOpen = false;
    return [
      {
        kind: 'pretty_dialog',
        open: true,
        action: 'cancel',
        btn: 'Cancel (esc)',
        windowTitle: 'TRACK_CPPEXPR.md - mlc - Cursor',
      },
    ];
  }

  isModalOpen(): boolean {
    return this.modalOpen;
  }
}

export {
  FIXTURE_ACTIVE_COMPOSER,
  FIXTURE_BUSY_COMPOSER,
  FIXTURE_MLC_COMPOSER,
  FIXTURE_NORD_COMPOSER,
};
