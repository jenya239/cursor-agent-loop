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
    env: { ...process.env, CDP_PORT: process.env.CDP_PORT || '9226', COPY_DB: '0' },
  });
  const client = new Client({ name: 'cr-mcp-smoke', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log('tools:', names.join(', '));
  const reg = await client.callTool({ name: 'cursor_agent_register', arguments: {} });
  console.log('cursor_agent_register:', reg.content[0]);
  const list = await client.callTool({ name: 'cursor_db_info', arguments: {} });
  console.log('cursor_db_info:', list.content[0]);
  await client.close();
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
