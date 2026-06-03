import fs from 'fs';
import path from 'path';
import { composerPageOrder, type CdpTarget } from './client';
import { fixturePageMeta, loadFixturePageMeta } from './fixture-page-meta';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { ActiveComposer } from './active-composer';
import { composerIdsMatch, filterTargetsByHints } from './window-match';
import type { ComposerBarProbe } from './composer-bar';
import { inferAgentRole } from './composer-bar';
import type { ComposerPanelProbe } from './composer-panel';
import { emptyComposerPanelControls, emptyComposerPanelInput } from './composer-panel';
import type { WindowLayoutData } from '../cursor/layout/types';
import { withAgentItemState } from '../cursor/layout/agent-item-state';
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
  | 'modal-revert'
  | 'draft-stuck'
  | 'multi-busy'
  | 'slow';

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
  private draftStuck: boolean;
  private modelOverrides = new Map<string, string>();
  private stoppedWindows = new Set<string>();

  constructor(private readonly scenario: FixtureScenario = 'idle') {
    this.modalOpen = scenario === 'modal-revert';
    this.draftStuck = scenario === 'draft-stuck';
  }

  async isAvailable(): Promise<boolean> {
    return this.scenario !== 'down';
  }

  async status(): Promise<{ ok: boolean; url: string }> {
    return { ok: await this.isAvailable(), url: 'fixture://cdp' };
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
        !this.stoppedWindows.has(t.title || '') &&
        (((this.scenario === 'busy' ||
          this.scenario === 'send-blocked' ||
          this.scenario === 'slow') &&
          /cr - cr - Cursor/i.test(t.title || '')) ||
          (this.scenario === 'multi-busy' && this.pageHasComposer(t)));
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

  probeComposerBar(windowTitle: string): ComposerBarProbe {
    const meta = fixturePageMeta(windowTitle);
    if (!meta?.hasComposer || this.scenario === 'no-bar') {
      return {
        composerId: '',
        model: '',
        agentRole: 'default',
        busy: false,
        slowCount: 0,
        reconnecting: false,
        draftLen: 0,
        draftHasToken: false,
        pairs: [],
      };
    }
    const reconnecting =
      this.scenario === 'slow' &&
      /reconnect/i.test(windowTitle) &&
      !this.stoppedWindows.has(windowTitle);
    const busy =
      !this.stoppedWindows.has(windowTitle) &&
      (reconnecting ||
        (((this.scenario === 'busy' || this.scenario === 'send-blocked' || this.scenario === 'slow') &&
          /cr - cr - Cursor/i.test(windowTitle)) ||
          (this.scenario === 'multi-busy' && !!meta.hasComposer)));
    const model = this.modelOverrides.get(meta.title) ?? meta.model ?? '';
    const slowOnCr = this.scenario === 'slow' && /cr - cr - Cursor/i.test(windowTitle);
    const slowCount = slowOnCr ? 1 : (meta.slowCount ?? 0);
    const pairs =
      slowOnCr || meta.slowPair
        ? [{ preview: 'AGENT_TOKEN=…', slow: true }]
        : [];
    const agentRole = this.modelOverrides.has(meta.title)
      ? inferAgentRole(model)
      : inferAgentRole(model, meta.agentRole);
    return {
      composerId: meta.activeComposerId || '',
      model,
      agentRole,
      busy,
      slowCount,
      reconnecting,
      draftLen: meta.draftLen ?? 0,
      draftHasToken: meta.draftHasToken ?? false,
      pairs,
    };
  }

  probeComposerPanel(windowTitle: string): ComposerPanelProbe {
    const bar = this.probeComposerBar(windowTitle);
    const meta = fixturePageMeta(windowTitle);
    if (!meta?.hasComposer || this.scenario === 'no-bar') {
      return {
        ok: false,
        reason: 'no-bar',
        shell: 'none',
        composerId: '',
        agentRole: 'default',
        runState: 'idle',
        slowCount: 0,
        input: emptyComposerPanelInput(),
        model: { label: '', pickerOpen: false },
        mode: null,
        context: { pills: [], usagePct: null, usageVisible: false },
        controls: emptyComposerPanelControls(),
      };
    }
    const shell = meta.shell === 'agents-v3' ? 'agents-v3' : 'workbench-v2';
    const runState = bar.busy ? (bar.slowCount ? 'slow' : 'busy') : bar.slowCount ? 'slow' : 'idle';
    const base: ComposerPanelProbe = {
      ok: true,
      shell,
      composerId: bar.composerId,
      agentRole: bar.agentRole,
      runState,
      slowCount: bar.slowCount,
      input: {
        kind: runState !== 'idle' && shell === 'agents-v3' ? 'readonly' : 'editable',
        placeholder: 'Plan, Build, / for commands, @ for context',
        draftLen: bar.draftLen,
        empty: bar.draftLen === 0,
        focused: false,
        hasToken: bar.draftHasToken,
      },
      model: { label: bar.model, pickerOpen: false },
      mode: { id: 'agent', label: 'Agent' },
      context: {
        pills:
          shell === 'agents-v3'
            ? [{ label: '1 Terminal', kind: 'terminal', aria: 'Open terminals (1)' }]
            : [],
        usagePct: bar.draftLen > 0 ? 88 : 12,
        usageVisible: shell === 'workbench-v2',
      },
      controls: {
        mode: { id: 'agent', label: 'Agent', visible: true, enabled: true },
        model: { label: bar.model, visible: !!bar.model, enabled: true },
        submit: {
          visible: runState === 'idle',
          enabled: runState === 'idle' && bar.draftLen > 0,
          label: 'Send',
          sendMode: 'agent',
        },
        stop: {
          visible: runState !== 'idle',
          enabled: runState !== 'idle',
          label: 'Stop',
        },
        plus: { visible: false, enabled: false, label: 'Attach' },
      },
    };
    if (!meta.composerPanel) return base;
    return {
      ...base,
      ...meta.composerPanel,
      input: { ...base.input, ...(meta.composerPanel.input || {}) },
      model: { ...base.model, ...(meta.composerPanel.model || {}) },
      mode:
        meta.composerPanel.mode === undefined
          ? base.mode
          : meta.composerPanel.mode === null
            ? null
            : { ...(base.mode || { id: 'agent', label: 'Agent' }), ...meta.composerPanel.mode },
      context: { ...base.context, ...(meta.composerPanel.context || {}), pills: meta.composerPanel.context?.pills ?? base.context.pills },
      controls: {
        mode: { ...base.controls.mode, ...(meta.composerPanel.controls?.mode || {}) },
        model: { ...base.controls.model, ...(meta.composerPanel.controls?.model || {}) },
        submit: { ...base.controls.submit, ...(meta.composerPanel.controls?.submit || {}) },
        stop: { ...base.controls.stop, ...(meta.composerPanel.controls?.stop || {}) },
        plus: { ...base.controls.plus, ...(meta.composerPanel.controls?.plus || {}) },
      },
    };
  }

  setComposerModel(windowTitleNeedle: string, model: string): { ok: boolean; reason: string } {
    const meta = loadFixturePageMeta().find(
      (m) => windowTitleNeedle.includes(m.title) || m.title.includes(windowTitleNeedle)
    );
    if (!meta) return { ok: false, reason: 'window-not-found' };
    this.modelOverrides.set(meta.title, model);
    return { ok: true, reason: 'set' };
  }

  getComposerModel(windowTitleNeedle: string): string | null {
    const meta = fixturePageMeta(windowTitleNeedle);
    if (!meta) return null;
    return this.modelOverrides.get(meta.title) ?? meta.model ?? null;
  }

  async sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult> {
    if (this.scenario === 'down') throw new Error('cdp unavailable');
    if (this.scenario === 'no-bar') throw new Error('composer no-bar');
    if (this.scenario === 'send-blocked') {
      throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
    }
    if (this.scenario === 'draft-stuck' && this.draftStuck) {
      throw new Error(
        'composer not empty (draft 42 chars) — clear field manually; revert modal if open'
      );
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

  layoutDataForWindow(windowTitle: string): WindowLayoutData {
    const meta = fixturePageMeta(windowTitle);
    const layout: WindowLayoutData = JSON.parse(JSON.stringify(meta?.layout ?? {}));
    if (layout.agentList) {
      layout.agentList = layout.agentList.map((a) => withAgentItemState(a));
    }
    const busyCr =
      !this.stoppedWindows.has(windowTitle) &&
      (this.scenario === 'busy' || this.scenario === 'slow') &&
      /cr - cr - Cursor/i.test(windowTitle);
    if (busyCr) {
      layout.thread = {
        turnCount: 2,
        slowCount: this.scenario === 'slow' ? 1 : 0,
        activeTool: 'Worked for 8s',
        turns: [
          {
            preview: 'AGENT_TOKEN=…',
            slow: this.scenario === 'slow',
            toolCalls: [{ label: 'Worked for 8s', state: 'running' }],
          },
        ],
      };
      layout.agentList = layout.agentList?.map((a) =>
        withAgentItemState({ ...a, busy: true, active: true })
      );
    }
    if (this.scenario === 'modal-revert' && this.modalOpen) {
      layout.blockers = {
        blockers: [{ kind: 'revert', label: 'Submit from a previous message?', blocking: true }],
        sendBlocked: true,
      };
    }
    return layout;
  }

  async stopAgent(opts?: { windowTitle?: string }): Promise<{ ok: boolean; reason: string }> {
    const meta = loadFixturePageMeta().find(
      (m) => !opts?.windowTitle || opts.windowTitle.includes(m.title) || m.title.includes(opts.windowTitle)
    );
    const title = meta?.title || opts?.windowTitle || '';
    const bar = this.probeComposerBar(title);
    if (!bar.busy) return { ok: false, reason: 'no-stop' };
    this.stoppedWindows.add(title);
    if (meta?.title) this.stoppedWindows.add(meta.title);
    return { ok: true, reason: 'clicked-stop' };
  }

  clearComposerDraft(): void {
    this.draftStuck = false;
  }

  hasComposerDraft(): boolean {
    return this.draftStuck;
  }
}

export {
  FIXTURE_ACTIVE_COMPOSER,
  FIXTURE_BUSY_COMPOSER,
  FIXTURE_MLC_COMPOSER,
  FIXTURE_NORD_COMPOSER,
};
