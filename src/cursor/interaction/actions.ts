import type { StepContext } from './types';

export const actions = {
  noop: () => async (_ctx: StepContext) => {},

  send:
    (text: string, opts?: { windowTitle?: string }) =>
    async (ctx: StepContext) => {
      await ctx.cdp.sendMessage(text, { windowTitle: opts?.windowTitle ?? ctx.windowTitle });
    },

  stop:
    (opts?: { windowTitle?: string }) =>
    async (ctx: StepContext) => {
      await ctx.cdp.stopAgent({ windowTitle: opts?.windowTitle ?? ctx.windowTitle });
    },

  dismiss: () => async (ctx: StepContext) => {
    await ctx.cdp.dismissModals();
  },

  switchComposer:
    (composerId: string, opts?: { windowTitle?: string; workspaceHints?: string[] }) =>
    async (ctx: StepContext) => {
      const r = await ctx.cdp.switchComposer(composerId, {
        windowTitle: opts?.windowTitle ?? ctx.windowTitle,
        workspaceHints: opts?.workspaceHints,
      });
      if (!r.ok) throw new Error(r.reason);
    },
};

export const fallbacks = {
  dismissModals: () => async (ctx: StepContext) => {
    const d = await ctx.cdp.dismissModals();
    return d.some((x) => x.open);
  },
};
