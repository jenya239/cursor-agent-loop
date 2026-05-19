import { AgentModel } from '../../src/agent-model';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { CursorDbReader } from '../../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID } from '../fixture';

describe('CursorMock', () => {
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

  it('idle', async () => {
    const m = new AgentModel(reader, CursorMock.idle());
    const st = await m.forComposer(COMPOSER_ID);
    expect(st.cdpOk).toBe(true);
    expect(st.busy).toBe(false);
    expect(st.cdpBusy).toBe(false);
  });

  it('agentRunning', async () => {
    const m = new AgentModel(reader, CursorMock.agentRunning());
    const st = await m.forComposer(COMPOSER_ID);
    expect(st.cdpBusy).toBe(true);
    expect(st.busy).toBe(true);
    expect(st.cdpReason).toBe('stop-icon');
  });

  it('cdpDown', async () => {
    const m = new AgentModel(reader, CursorMock.cdpDown());
    const st = await m.forCdp();
    expect(st.cdpOk).toBe(false);
    expect(st.phase).toBe('unknown');
  });
});
