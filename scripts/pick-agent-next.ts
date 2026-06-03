import path from 'path';
import { buildNudgePrompt, pickNextAgentStep } from '../src/cursor/agent_next';

const agentDir = process.env.CR_AGENT_DIR || path.join(__dirname, '../docs/agent');
const target = process.argv[2] || 'cr';

const dir = target === 'mlc'
  ? process.env.MLC_AGENT_DIR || path.join(__dirname, '../../../current/mlc/docs/agent')
  : agentDir;

console.log(JSON.stringify({ target, ...pickNextAgentStep(dir) }, null, 2));
