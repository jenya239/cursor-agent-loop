import { ChatStore } from '../../chat-store';
import { CursorDbReader } from '../../db/reader';
import { CursorModel } from '../../cursor/cursor-model';
import { FixtureCdp, type FixtureScenario } from '../../cdp/fixture-cdp';
import { bindAgentToken } from '../../cursor/token-bind';
import { COMPOSER_ID, createTestDb, removeTestDb } from '../../db/test-db';
import { ModelApi } from './model-api';
import type { CrApi } from './cr-api';

export type UiFixtureScenario = 'idle' | 'busy' | 'cdp-down' | 'send-blocked';

const FIXTURE_TOKEN = 'cr-agent-ui-fixture-000000000001';

function toFixtureScenario(s: UiFixtureScenario): FixtureScenario {
  if (s === 'cdp-down') return 'down';
  return s;
}

/** In-memory CrApi backed by CursorModel + FixtureCdp + test db. */
export class FixtureApi extends ModelApi implements CrApi {
  readonly reader: CursorDbReader;
  private readonly dbPath: string;
  private readonly ready: Promise<void>;

  constructor(scenario: UiFixtureScenario = 'idle') {
    const dbPath = createTestDb();
    const reader = CursorDbReader.fromPath(dbPath);
    const store = new ChatStore(reader, dbPath, true);
    const cdp = new FixtureCdp(toFixtureScenario(scenario));
    const model = new CursorModel(store, cdp);
    bindAgentToken(FIXTURE_TOKEN, COMPOSER_ID);
    super(model, store, { token: FIXTURE_TOKEN, defaultComposerId: COMPOSER_ID });
    this.reader = reader;
    this.dbPath = dbPath;
    this.ready = store.refresh();
  }

  private async go(): Promise<void> {
    await this.ready;
  }

  async snapshot(composerId?: string) {
    await this.go();
    return super.snapshot(composerId);
  }

  async chat(composerId: string, fresh?: boolean) {
    await this.go();
    return super.chat(composerId, fresh);
  }

  async send(text: string, composerId?: string, windowTitle?: string) {
    await this.go();
    return super.send(text, composerId, windowTitle);
  }

  async refreshDb() {
    await this.go();
    return super.refreshDb();
  }

  async listChats() {
    await this.go();
    return super.listChats();
  }

  async status() {
    await this.go();
    return super.status();
  }

  dispose(): void {
    this.reader.close();
    removeTestDb(this.dbPath);
  }
}

export { FIXTURE_TOKEN };
