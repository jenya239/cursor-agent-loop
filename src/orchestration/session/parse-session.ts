export function parseSessionContent(content: string): {
  driverTurnsSincePlan: number;
  roleLast?: string;
  stepLast?: string;
  activeTrack?: string;
} {
  const lastNumericMatch = (re: RegExp) =>
    [...content.matchAll(re)].map((m) => m[1].trim()).filter((v) => /^\d+$/.test(v)).pop();
  const lastMatch = (re: RegExp) =>
    [...content.matchAll(re)].map((m) => m[1].trim()).filter((v) => !v.startsWith('<')).pop();
  return {
    driverTurnsSincePlan: Number(lastNumericMatch(/driver_turns_since_plan\s*\|\s*([^|\n]+)/g) ?? 0),
    roleLast: lastMatch(/role_last\s*\|\s*([^|\n]+)/g),
    stepLast: lastMatch(/step_last\s*\|\s*([^|\n]+)/g),
    activeTrack: lastMatch(/TRACK_\w+\s*\|\s*([^\n|]+)/g),
  };
}

export function patchSessionField(content: string, name: string, value: string): string {
  const re = new RegExp(`(\\|\\s*${name}\\s*\\|\\s*)([^\\n|]+)(\\s*\\|)`);
  return re.test(content) ? content.replace(re, `$1${value}$3`) : content;
}

export function recordSessionNudge(
  content: string,
  fields: {
    role: string;
    step: string;
    instructionsRev: string;
    driverTurnsSincePlan: number;
  }
): string {
  let out = content;
  out = patchSessionField(out, 'instructions_rev', `\`${fields.instructionsRev}\``);
  out = patchSessionField(out, 'role_last', fields.role);
  out = patchSessionField(out, 'step_last', fields.step);
  out = patchSessionField(out, 'driver_turns_since_plan', String(fields.driverTurnsSincePlan));
  return out;
}
