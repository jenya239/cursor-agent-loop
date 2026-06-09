import { FixtureApi } from '../../src/ui/api/fixture-api';
import { COMPOSER_ID } from '../../src/db/test-db';

describe('FixtureApi', () => {
  let api: FixtureApi;

  afterEach(() => {
    api?.dispose();
  });

  it('busy snapshot from CursorModel', async () => {
    api = new FixtureApi('busy');
    const s = await api.snapshot();
    expect(s.agent.busy).toBe(true);
    expect(s.cdp.ok).toBe(true);
  });

  it('idle lists chats from db', async () => {
    api = new FixtureApi('idle');
    const { chats } = await api.listChats();
    expect(chats.some((c) => c.composerId === COMPOSER_ID)).toBe(true);
  });

  it('cdp-down snapshot', async () => {
    api = new FixtureApi('cdp-down');
    const s = await api.snapshot();
    expect(s.cdp.ok).toBe(false);
  });

  it('send-blocked throws', async () => {
    api = new FixtureApi('send-blocked');
    await expect(api.send('x')).rejects.toThrow(/agent/);
  });
});
