export class StuckTracker {
  private firstBusyAt = new Map<string, number>();

  noteBusy(windowTitle: string, now: number): number {
    const prev = this.firstBusyAt.get(windowTitle);
    if (prev == null) {
      this.firstBusyAt.set(windowTitle, now);
      return 0;
    }
    return now - prev;
  }

  clear(windowTitle: string): void {
    this.firstBusyAt.delete(windowTitle);
  }
}
