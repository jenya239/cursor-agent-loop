import { scheduleSendRelease } from '../src/send-guard';

describe('scheduleSendRelease', () => {
  it('calls release after delay', () => {
    jest.useFakeTimers();
    const release = jest.fn();
    scheduleSendRelease(release, 100, (fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    });
    jest.advanceTimersByTime(100);
    expect(release).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
