import fs from 'fs';
import path from 'path';
import {
  listMeetingsFromDatabase,
  meetingToRecord,
  replaceMeetings,
} from '../db/meetings';
import type { MeetingSummary } from '../progress/report';
import { listMeetingFiles } from './parse-meeting';

function mergeMeetings(
  fromDirectory: MeetingSummary[],
  fromDatabase: MeetingSummary[]
): MeetingSummary[] {
  const bySlug = new Map<string, MeetingSummary>();
  for (const meeting of fromDatabase) bySlug.set(meeting.slug, meeting);
  for (const meeting of fromDirectory) {
    const cached = bySlug.get(meeting.slug);
    bySlug.set(meeting.slug, {
      slug: meeting.slug,
      topic: meeting.topic,
      path: meeting.path,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt ?? cached?.endedAt ?? null,
    });
  }
  return [...bySlug.values()].sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt)
  );
}

export function syncMeetingsFromDirectory(
  meetingsDirectory: string,
  options?: { databasePath?: string; limit?: number }
): number {
  const meetings = listMeetingFiles(meetingsDirectory).slice(0, options?.limit ?? 100);
  const records = meetings.map((meeting) => meetingToRecord(meeting));
  return replaceMeetings(records, options?.databasePath);
}

export function loadCachedMeetings(
  meetingsDirectory: string,
  options?: { databasePath?: string; limit?: number }
): MeetingSummary[] {
  const limit = options?.limit ?? 25;
  const cached = listMeetingsFromDatabase({ limit, databasePath: options?.databasePath });
  if (cached.length > 0) return cached;
  syncMeetingsFromDirectory(meetingsDirectory, options);
  return listMeetingsFromDatabase({ limit, databasePath: options?.databasePath });
}

export function listMeetings(
  meetingsDirectory: string,
  options?: { databasePath?: string; limit?: number }
): MeetingSummary[] {
  const limit = options?.limit ?? 25;
  const fromDirectory = listMeetingFiles(meetingsDirectory).slice(0, limit);
  const fromDatabase = listMeetingsFromDatabase({
    limit,
    databasePath: options?.databasePath,
  });
  if (fromDirectory.length === 0 && fromDatabase.length === 0) {
    syncMeetingsFromDirectory(meetingsDirectory, options);
    return listMeetingsFromDatabase({ limit, databasePath: options?.databasePath });
  }
  return mergeMeetings(fromDirectory, fromDatabase).slice(0, limit);
}

export type MeetingsWatcher = {
  stop: () => void;
};

export function startMeetingsWatcher(
  meetingsDirectory: string,
  options?: {
    databasePath?: string;
    debounceMilliseconds?: number;
    watchDirectory?: typeof fs.watch;
  }
): MeetingsWatcher {
  const debounceMilliseconds = options?.debounceMilliseconds ?? 300;
  const watchDirectory = options?.watchDirectory ?? fs.watch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: fs.FSWatcher | undefined;

  const scheduleSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      syncMeetingsFromDirectory(meetingsDirectory, {
        databasePath: options?.databasePath,
      });
    }, debounceMilliseconds);
  };

  try {
    fs.mkdirSync(meetingsDirectory, { recursive: true });
    syncMeetingsFromDirectory(meetingsDirectory, { databasePath: options?.databasePath });
    watcher = watchDirectory(meetingsDirectory, scheduleSync);
  } catch {
    /* meetings dir may be unavailable */
  }

  return {
    stop() {
      if (timer) clearTimeout(timer);
      watcher?.close();
    },
  };
}
