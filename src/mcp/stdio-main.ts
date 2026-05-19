import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCrMcpRuntime } from './bootstrap';
import { createCrMcpServer } from './register';

function hookProcessErrors(): void {
  const log = (label: string, e: unknown) => {
    const msg = e instanceof Error ? e.stack || e.message : String(e);
    process.stderr.write(`[cr-mcp] ${label}: ${msg}\n`);
  };
  process.on('uncaughtException', (e) => log('uncaughtException', e));
  process.on('unhandledRejection', (e) => log('unhandledRejection', e));
}

async function main(): Promise<void> {
  hookProcessErrors();
  const runtime = await createCrMcpRuntime();
  const server = createCrMcpServer(runtime.deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', () => {
    runtime.close();
    process.exit(0);
  });
}

main().catch((e) => {
  process.stderr.write(`[cr-mcp] fatal: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
