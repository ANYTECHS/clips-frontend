import { OutboundWebhookService } from './outbound-webhook.service';
import { WebhookSignature } from './webhook-signature';

describe('WebhookSignature (Issue #1400)', () => {
  const secret = 'whsec_testsecret';
  const body = JSON.stringify({ hello: 'world' });

  it('produces sha256=<hex> signatures that verify', () => {
    const sig = WebhookSignature.sign(secret, body);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(WebhookSignature.verify(secret, body, sig)).toBe(true);
  });

  it('rejects tampered bodies and wrong secrets', () => {
    const sig = WebhookSignature.sign(secret, body);
    expect(WebhookSignature.verify(secret, body + ' ', sig)).toBe(false);
    expect(WebhookSignature.verify('whsec_other', body, sig)).toBe(false);
    expect(WebhookSignature.verify(secret, body, undefined)).toBe(false);
  });
});

describe('OutboundWebhookService (Issue #1400)', () => {
  const prisma = { webhookSubscription: { findMany: jest.fn() } };
  let service: OutboundWebhookService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OutboundWebhookService(prisma as any);
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (global as any).fetch = fetchMock;
  });

  it('signs deliveries with HMAC-SHA256 over the raw body', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        url: 'https://example.com/hook',
        secret: 'whsec_s3cr3t',
        events: ['earning.created'],
      },
    ]);

    const res = await service.dispatch(1, 'earning.created', { amount: 5 });

    expect(res).toEqual({ delivered: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(init.headers['X-Clips-Event']).toBe('earning.created');
    expect(init.headers['X-Clips-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);

    // The signature must verify against the exact raw body sent.
    expect(
      WebhookSignature.verify(
        'whsec_s3cr3t',
        init.body,
        init.headers['X-Clips-Signature'],
      ),
    ).toBe(true);

    const payload = JSON.parse(init.body);
    expect(payload.event).toBe('earning.created');
    expect(payload.data).toEqual({ amount: 5 });
  });

  it('only delivers to subscriptions matching the event', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([]);
    const res = await service.dispatch(1, 'clip.minted', {});
    expect(res).toEqual({ delivered: 0, failed: 0 });
    expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 1, isActive: true }),
      }),
    );
  });

  it('counts failed deliveries without throwing', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      { id: 's1', url: 'https://a', secret: 'x', events: ['*'] },
      { id: 's2', url: 'https://b', secret: 'y', events: ['*'] },
    ]);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error('network down'));

    const res = await service.dispatch(1, 'earning.created', {});
    expect(res).toEqual({ delivered: 0, failed: 2 });
  });
});
