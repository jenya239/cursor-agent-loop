import fs from 'fs';
import path from 'path';
import type { MeetingSummary } from '../progress/report';

const MEETING_FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

export function parseMeetingFilename(filename: string): {
  date: string;
  topic: string;
  slug: string;
} | null {
  const match = filename.match(MEETING_FILENAME_PATTERN);
  if (!match) return null;
  const [, date, topicPart] = match;
  const topic = topicPart.replace(/-/g, ' ');
  return { date, topic, slug: `${date}-${topicPart}` };
}

function endedAtFromContent(content: string): string | null {
  const match = content.match(/\|\s*ended\s*\|\s*([^|\n]+)\s*\|/i);
  if (!match) return null;
  const value = match[1].trim();
  return value && value !== '—' && value !== '-' ? value : null;
}

export function parseMeetingFile(filePath: string): MeetingSummary | null {
  const parsed = parseMeetingFilename(path.basename(filePath));
  if (!parsed) return null;
  let endedAt: string | null = null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    endedAt = endedAtFromContent(content);
  } catch {
    /* ignore */
  }
  return {
    slug: parsed.slug,
    topic: parsed.topic,
    path: filePath,
    startedAt: parsed.date,
    endedAt,
  };
}

export function listMeetingFiles(meetingsDirectory: string): MeetingSummary[] {
  if (!fs.existsSync(meetingsDirectory)) return [];
  return fs
    .readdirSync(meetingsDirectory)
    .flatMap((name) => {
      const filePath = path.join(meetingsDirectory, name);
      try {
        if (!fs.statSync(filePath).isFile()) return [];
      } catch {
        return [];
      }
      const meeting = parseMeetingFile(filePath);
      return meeting ? [meeting] : [];
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}
