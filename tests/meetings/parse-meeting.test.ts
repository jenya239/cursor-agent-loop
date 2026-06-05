import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseMeetingFilename, parseMeetingFile } from '../../src/meetings/parse-meeting';

describe('parse meeting', () => {
  it('parses meeting filename', () => {
    const parsed = parseMeetingFilename('2026-06-05-rename-abbrev-planning.md');
    expect(parsed).toEqual({
      date: '2026-06-05',
      topic: 'rename abbrev planning',
      slug: '2026-06-05-rename-abbrev-planning',
    });
  });

  it('rejects invalid filename', () => {
    expect(parseMeetingFilename('notes.md')).toBeNull();
  });

  it('parses ended field from markdown', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-meeting-'));
    const filePath = path.join(directory, '2026-06-05-agent-roles.md');
    fs.writeFileSync(
      filePath,
      `| field | value |
|-------|-------|
| ended | 2026-06-06 |
`
    );
    try {
      const meeting = parseMeetingFile(filePath);
      expect(meeting?.topic).toBe('agent roles');
      expect(meeting?.endedAt).toBe('2026-06-06');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
