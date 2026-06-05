import type { MeetingSummary } from '../progress/report';
import { openCrDatabase } from './migrate';

export type MeetingRow = {
  id: number;
  slug: string;
  topic: string;
  path: string | null;
  started_at: string;
  ended_at: string | null;
};

export type MeetingRecord = {
  slug: string;
  topic: string;
  path?: string | null;
  startedAt: string;
  endedAt?: string | null;
};

export function meetingToRecord(meeting: MeetingSummary): MeetingRecord {
  return {
    slug: meeting.slug,
    topic: meeting.topic,
    path: meeting.path,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
  };
}

export function replaceMeetings(
  meetings: MeetingRecord[],
  databasePath?: string
): number {
  const database = openCrDatabase(databasePath);
  try {
    const remove = database.prepare('DELETE FROM meetings');
    const insert = database.prepare(`
      INSERT INTO meetings (slug, topic, path, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const transaction = database.transaction((rows: MeetingRecord[]) => {
      remove.run();
      for (const row of rows) {
        insert.run(
          row.slug,
          row.topic,
          row.path ?? null,
          row.startedAt,
          row.endedAt ?? null
        );
      }
      return rows.length;
    });
    return transaction(meetings);
  } finally {
    database.close();
  }
}

export function listMeetingRows(options?: {
  limit?: number;
  databasePath?: string;
}): MeetingRow[] {
  const limit = options?.limit ?? 25;
  const database = openCrDatabase(options?.databasePath);
  try {
    return database
      .prepare('SELECT * FROM meetings ORDER BY started_at DESC LIMIT ?')
      .all(limit) as MeetingRow[];
  } finally {
    database.close();
  }
}

export function meetingRowsToSummaries(rows: MeetingRow[]): MeetingSummary[] {
  return rows.map((row) => ({
    slug: row.slug,
    topic: row.topic,
    path: row.path ?? '',
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }));
}

export function listMeetingsFromDatabase(options?: {
  limit?: number;
  databasePath?: string;
}): MeetingSummary[] {
  return meetingRowsToSummaries(listMeetingRows(options));
}
