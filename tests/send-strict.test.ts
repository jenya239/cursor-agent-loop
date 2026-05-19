describe('send-strict', () => {
  const prev = process.env.CR_SEND_STRICT;

  afterEach(() => {
    if (prev === undefined) delete process.env.CR_SEND_STRICT;
    else process.env.CR_SEND_STRICT = prev;
    jest.resetModules();
  });

  it('strict by default', async () => {
    delete process.env.CR_SEND_STRICT;
    jest.resetModules();
    const { isSendStrict } = await import('../src/send-strict');
    expect(isSendStrict()).toBe(true);
  });

  it('soft when CR_SEND_STRICT=0', async () => {
    process.env.CR_SEND_STRICT = '0';
    jest.resetModules();
    const { isSendStrict } = await import('../src/send-strict');
    expect(isSendStrict()).toBe(false);
  });
});
