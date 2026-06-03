export type UiTab = 'chats' | 'watchdog' | 'layout' | 'progress';

export function tabVisibility(tab: UiTab): {
  layoutHidden: boolean;
  watchdogHidden: boolean;
  layoutPanelHidden: boolean;
  progressHidden: boolean;
} {
  return {
    layoutHidden: tab !== 'chats',
    watchdogHidden: tab !== 'watchdog',
    layoutPanelHidden: tab !== 'layout',
    progressHidden: tab !== 'progress',
  };
}
