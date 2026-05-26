export class SlowTracker {
  private firstSeen = new Map<string, number>();

  note(windowTitle: string, slowCount: number, now: number): number | null {
    if (slowCount <= 0) {
      this.firstSeen.delete(windowTitle);
      return null;
    }
    const prev = this.firstSeen.get(windowTitle);
    if (prev == null) {
      this.firstSeen.set(windowTitle, now);
      return 0;
    }
    return now - prev;
  }

  clear(windowTitle: string): void {
    this.firstSeen.delete(windowTitle);
  }
}
