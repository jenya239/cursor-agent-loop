import { AgentModel } from '../src/agent-model';
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
    const model = new AgentModel(reader, async () => ({ ok: true, busy: true }));
    const st = await model.forComposer(COMPOSER_ID);
    expect(st.dbBusy).toBe(false);
    expect(st.cdpBusy).toBe(true);
    expect(st.busy).toBe(true);
  });
});
