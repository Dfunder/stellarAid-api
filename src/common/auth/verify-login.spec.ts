import { hashPassword, verifyLogin } from './verify-login';

describe('verifyLogin', () => {
  it('accepts the right password only', async () => {
    const credential = await hashPassword('secret');
    expect(await verifyLogin(credential, 'secret')).toBe(true);
    expect(await verifyLogin(credential, 'wrong')).toBe(false);
  });

  it('rejects unknown users', async () => {
    expect(await verifyLogin(undefined, 'secret')).toBe(false);
  });
});
