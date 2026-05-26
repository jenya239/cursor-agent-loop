import { AgentModel } from '../src/agent-model';
import { CursorMock } from '../src/cdp/cursor-mock';
import { FixtureCdp, FIXTURE_BUSY_COMPOSER, FIXTURE_MLC_COMPOSER } from '../src/cdp/fixture-cdp';
import { CursorDbReader } from '../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID, BUSY_COMPOSER_ID } from './fixture';

describe('AgentModel', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  beforeEach(() => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('merges db and cdp busy', async () => {
    const model = new AgentModel(reader, async () => ({ ok: true, busy: false }));
    const st = await model.forComposer(BUSY_COMPOSER_ID);
    expect(st.dbBusy).toBe(true);
    expect(st.busy).toBe(true);
    expect(st.phase).toBe('busy');
  });

  it('cdp busy when db idle', async () => {
    const model = new AgentModel(reader, CursorMock.agentRunning());
    const st = await model.forComposer(COMPOSER_ID);
    expect(st.dbBusy).toBe(false);
    expect(st.cdpBusy).toBe(true);
    expect(st.busy).toBe(true);
  });

  it('cdp scoped to composer window', async () => {
    const model = new AgentModel(reader, CursorMock.probeFrom(new FixtureCdp('busy')));
    const mlc = await model.forComposer(FIXTURE_MLC_COMPOSER);
    expect(mlc.cdpBusy).toBe(false);
    expect(mlc.busy).toBe(false);
    const cr = await model.forComposer(FIXTURE_BUSY_COMPOSER);
    expect(cr.cdpBusy).toBe(true);
  });

  it('forComposer idle composer not busy globally', async () => {
    const model = new AgentModel(reader, CursorMock.probeFrom(new FixtureCdp('busy')));
    const st = await model.forComposer(COMPOSER_ID);
    expect(st.cdpBusy).toBe(true);
  });
});
