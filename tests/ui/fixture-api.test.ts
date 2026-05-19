import { FixtureApi } from '../../src/ui/api/fixture-api';

describe('FixtureApi', () => {
  it('busy snapshot', async () => {
    const api = new FixtureApi('busy');
    const s = await api.snapshot();
    expect(s.agent.busy).toBe(true);
  });
});
