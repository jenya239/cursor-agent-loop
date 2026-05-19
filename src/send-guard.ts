export type ReleaseFn = () => void;

export function scheduleSendRelease(
  release: () => void,
  ms: number,
  schedule: (fn: () => void, delay: number) => ReleaseFn = (fn, delay) => {
    const id = setTimeout(fn, delay);
    return () => clearTimeout(id);
  }
): ReleaseFn {
  return schedule(release, ms);
}
