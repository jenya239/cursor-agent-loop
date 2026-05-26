import type Database from 'better-sqlite3';

export function seedRegisterBubble(
  db: Database.Database,
  composerId: string,
  token: string,
  toolStatus = 'completed'
): void {
  const insertKv = db.prepare(
    'INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)'
  );
  const bubbleId = `reg-${composerId.slice(0, 8)}`;
  const result = JSON.stringify({ token, kind: 'cr-agent-token', v: 1 });
  insertKv.run(
    `composerData:${composerId}`,
    JSON.stringify({
      composerId,
      name: `Chat ${composerId.slice(0, 8)}`,
      lastUpdatedAt: Date.now(),
      fullConversationHeadersOnly: [{ bubbleId, type: 2 }],
      conversationMap: {
        [bubbleId]: {
          toolFormerData: {
            name: 'cursor_agent_register',
            status: toolStatus,
            result,
          },
        },
      },
    })
  );
  insertKv.run(
    `bubbleId:${composerId}:${bubbleId}`,
    JSON.stringify({
      toolFormerData: {
        name: 'cursor_agent_register',
        status: toolStatus,
        result,
      },
    })
  );
}
