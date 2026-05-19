/** @jest-environment node */
import { initialUiState, reduceUi } from '../../src/ui/state/store';
import idle from '../ui-fixtures/snapshot-idle.json';

describe('CrStore reducer', () => {
  it('SNAPSHOT updates agent without chats', () => {
    const s0 = initialUiState(false);
    const s1 = reduceUi(s0, { type: 'SNAPSHOT', snap: idle as never });
    expect(s1.agent?.busy).toBe(false);
    expect(s1.chats.length).toBe(0);
  });

  it('SELECT_CHAT clears messages', () => {
    const s1 = reduceUi(initialUiState(false), {
      type: 'SELECT_CHAT',
      composerId: 'x',
    });
    expect(s1.activeComposerId).toBe('x');
    expect(s1.messages).toEqual([]);
  });
});
