import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

const node =
  process.env.CR_MCP_NODE ||
  '/usr/share/cursor/resources/app/resources/helpers/node';
const entry = path.resolve('dist/mcp/stdio-main.js');

async function main() {
  const transport = new StdioClientTransport({
    command: node,
    args: [entry],
    env: { ...process.env, CDP_PORT: process.env.CDP_PORT || '9226' },
  });
  const client = new Client({ name: 'cr-mcp-smoke', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log('tools:', names.join(', '));
  const list = await client.callTool({ name: 'cursor_db_info', arguments: {} });
  const text = list.content.find((c) => c.type === 'text');
  console.log('cursor_db_info:', text && 'text' in text ? text.text : list);
  const chats = await client.callTool({
    name: 'cursor_list_chats',
    arguments: { workspace: 'cr', limit: 3 },
  });
  console.log('cursor_list_chats:', chats.content[0]);
  const chat = await client.callTool({
    name: 'cursor_get_chat',
    arguments: { composerId: '90b0b877-3af6-4ab7-91ae-4d259b3e6e21', messageLimit: 5 },
  });
  console.log('cursor_get_chat ok:', !chat.isError);
  const enq = await client.callTool({
    name: 'cursor_enqueue_send',
    arguments: {
      text: '[cr mcp queue] smoke — можно игнорировать',
      composerId: '90b0b877-3af6-4ab7-91ae-4d259b3e6e21',
    },
  });
  console.log('cursor_enqueue_send:', enq.content[0]);
  const q = await client.callTool({ name: 'cursor_send_queue_list', arguments: {} });
  console.log('cursor_send_queue_list:', q.content[0]);
  await client.close();
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
