import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { createTestDb, removeTestDb } from '../fixture';

describe('CursorModel.send', () => {
  let dbPath: string;
  let reader: CursorDbReader;
  let store: ChatStore;

  beforeEach(async () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    store = new ChatStore(reader, dbPath, true);
    await store.refresh();
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('sends via fixture cdp', async () => {
    const m = new CursorModel(store, CursorMock.port('idle'));
    const r = await m.send('hi');
    expect(r.text).toBe('hi');
  });

  it('switch-fail throws when strict', async () => {
    const m = new CursorModel(store, CursorMock.port('switch-fail'));
    await expect(m.send('hi', { composerId: '11111111-1111-1111-1111-111111111111' })).rejects.toThrow(
      /switch failed/
    );
  });

  it('switch-fail allowed when CR_SEND_STRICT=0', async () => {
    process.env.CR_SEND_STRICT = '0';
    jest.resetModules();
    const { CursorModel: M } = await import('../../src/cursor/cursor-model');
    const m = new M(store, CursorMock.port('switch-fail'));
    const r = await m.send('hi', { composerId: '11111111-1111-1111-1111-111111111111' });
    expect(r.text).toBe('hi');
    delete process.env.CR_SEND_STRICT;
    jest.resetModules();
  });
});
