export type UiTab = 'chats' | 'watchdog' | 'layout' | 'progress' | 'billing';

export function tabVisibility(tab: UiTab): {
  layoutHidden: boolean;
  watchdogHidden: boolean;
  layoutPanelHidden: boolean;
  progressHidden: boolean;
  billingHidden: boolean;
} {
  return {
    layoutHidden: tab !== 'chats',
    watchdogHidden: tab !== 'watchdog',
    layoutPanelHidden: tab !== 'layout',
    progressHidden: tab !== 'progress',
    billingHidden: tab !== 'billing',
  };
}
