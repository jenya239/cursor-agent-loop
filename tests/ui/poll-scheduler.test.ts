import { FixtureApi } from '../../src/ui/api/fixture-api';
import { CrStore } from '../../src/ui/state/store';
import { PollScheduler } from '../../src/ui/poll/poll-scheduler';

describe('PollScheduler', () => {
  it('tick loads snapshot', async () => {
    const store = new CrStore(false);
    const api = new FixtureApi('idle');
    const scheduler = new PollScheduler(api, store, {
      setInterval: () => () => {},
    });
    await scheduler.tick();
    expect(store.get().snapshot?.cdp.ok).toBe(true);
  });
});
