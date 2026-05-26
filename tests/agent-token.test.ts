import {
  REGISTER_TOOL_NAME,
  generateAgentToken,
  isValidAgentToken,
  tokenFromRegisterToolResult,
  TOKEN_PREFIX,
} from '../src/cursor/agent-token';

describe('agent-token', () => {
  it('generateAgentToken format', () => {
    const t = generateAgentToken();
    expect(t).toMatch(new RegExp(`^${TOKEN_PREFIX}[0-9a-f-]{36}$`));
    expect(isValidAgentToken(t)).toBe(true);
  });

  it('generateAgentToken injectable rng', () => {
    const uuid = '11111111-1111-1111-1111-111111111111';
    expect(generateAgentToken(() => uuid)).toBe(`${TOKEN_PREFIX}${uuid}`);
  });

  it('isValidAgentToken rejects garbage', () => {
    expect(isValidAgentToken('')).toBe(false);
    expect(isValidAgentToken('self')).toBe(false);
    expect(isValidAgentToken(`${TOKEN_PREFIX}short`)).toBe(false);
  });

  it('tokenFromRegisterToolResult accepts register payload', () => {
    const t = generateAgentToken(() => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const result = JSON.stringify({ token: t, kind: 'cr-agent-token', v: 1 });
    expect(tokenFromRegisterToolResult(result)).toBe(t);
  });

  it('tokenFromRegisterToolResult rejects plain token string', () => {
    const t = `${TOKEN_PREFIX}aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`;
    expect(tokenFromRegisterToolResult(t)).toBeNull();
    expect(tokenFromRegisterToolResult(JSON.stringify({ token: t }))).toBeNull();
  });

  it('REGISTER_TOOL_NAME', () => {
    expect(REGISTER_TOOL_NAME).toBe('cursor_agent_register');
  });
});
