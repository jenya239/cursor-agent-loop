import request from 'supertest';
import { createWatchdogApp } from '../../src/watchdog/http-api';
import { WatchdogStats } from '../../src/watchdog/stats';
import type { DaemonControl } from '../../src/watchdog/daemon';

function makeApp() {
  const stats = new WatchdogStats(1000);
  const daemon: DaemonControl = {
    tick: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
  };
  const app = createWatchdogApp({ stats, daemon, pid: 42, sock: '/tmp/w.sock' });
  return { app, stats, daemon };
}

describe('watchdog http-api', () => {
  it('GET /status', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.alive).toBe(true);
    expect(res.body.pid).toBe(42);
    expect(res.body.sock).toBe('/tmp/w.sock');
  });

  it('GET /stats', async () => {
    const { app, stats } = makeApp();
    stats.recordPoll();
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body.polls_total).toBe(1);
  });

  it('GET /log', async () => {
    const { app, stats } = makeApp();
    stats.recordError('x');
    const res = await request(app).get('/log');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
  });

  it('POST /pause and /resume', async () => {
    const { app, daemon } = makeApp();
    await request(app).post('/pause').expect(200);
    expect(daemon.pause).toHaveBeenCalled();
    await request(app).post('/resume').expect(200);
    expect(daemon.resume).toHaveBeenCalled();
  });

  it('POST /dismiss runs tick', async () => {
    const { app, daemon } = makeApp();
    await request(app).post('/dismiss').expect(200);
    expect(daemon.tick).toHaveBeenCalled();
  });

  it('DELETE /stop', async () => {
    const { app, daemon } = makeApp();
    await request(app).delete('/stop').expect(200);
    expect(daemon.stop).toHaveBeenCalled();
  });

  it('GET / returns html panel', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('cr-watchdog');
  });
});
