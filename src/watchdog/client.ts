import http from 'http';

export function watchdogRequest(
  method: string,
  urlPath: string,
  opts: { sock?: string; port?: number; host?: string }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const reqOpts: http.RequestOptions = {
      method,
      path: urlPath,
      headers: { Accept: 'application/json' },
    };
    if (opts.port) {
      reqOpts.hostname = opts.host ?? '127.0.0.1';
      reqOpts.port = opts.port;
    } else if (opts.sock) {
      reqOpts.socketPath = opts.sock;
      reqOpts.host = 'localhost';
    } else {
      reject(new Error('sock or port required'));
      return;
    }
    const req = http.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
