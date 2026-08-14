import { StubGatewayDriver } from './payment-gateway.driver';

describe('StubGatewayDriver', () => {
  it('always succeeds and returns a gateway reference', async () => {
    const driver = new StubGatewayDriver();
    const result = await driver.charge(41.8, 'order-123');
    expect(result.success).toBe(true);
    expect(result.gatewayRef).toContain('order-12'); // slice(0,8) of the id
  });

  it('returns a distinct reference per call', async () => {
    const driver = new StubGatewayDriver();
    const a = await driver.charge(10, 'order-abc');
    const b = await driver.charge(10, 'order-abc');
    expect(a.gatewayRef).not.toBe(b.gatewayRef);
  });
});
