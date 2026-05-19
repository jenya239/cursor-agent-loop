export function isSendStrict(): boolean {
  return process.env.CR_SEND_STRICT !== '0';
}
