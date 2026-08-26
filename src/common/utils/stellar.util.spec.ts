import {
  isValidStellarPublicKey,
  isValidStellarSecretKey,
  isValidTxHash,
  formatStellarAddress,
  maskWalletAddress,
} from './stellar.util';

describe('StellarUtil', () => {
  const validPublicKey = 'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSITOUsO2C72GJGDOL'.replace('s', 'S'); // Valid G... public key
  const validKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  const validSecretKey = 'SDAXWYSWVQ3HNLNPJ2G5ZRF2TY43QL2R45HUP26PYF4B5LNLZ7K7BJJT';
  const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  describe('isValidStellarPublicKey', () => {
    it('should return true for a valid Stellar ed25519 public key', () => {
      expect(isValidStellarPublicKey(validKey)).toBe(true);
    });

    it('should return false for invalid keys or wrong formats', () => {
      expect(isValidStellarPublicKey('invalid-key')).toBe(false);
      expect(isValidStellarPublicKey('')).toBe(false);
      expect(isValidStellarPublicKey(null as any)).toBe(false);
      expect(isValidStellarPublicKey('0x1234567890abcdef')).toBe(false);
      expect(isValidStellarPublicKey(validSecretKey)).toBe(false); // S seed is not public key
    });
  });

  describe('isValidStellarSecretKey', () => {
    it('should return true for a valid Stellar secret seed', () => {
      expect(isValidStellarSecretKey(validSecretKey)).toBe(true);
    });

    it('should return false for invalid secret seeds', () => {
      expect(isValidStellarSecretKey(validKey)).toBe(false);
      expect(isValidStellarSecretKey('not-a-secret')).toBe(false);
      expect(isValidStellarSecretKey('')).toBe(false);
    });
  });

  describe('isValidTxHash', () => {
    it('should return true for 64-char hex hash', () => {
      expect(isValidTxHash(validHash)).toBe(true);
    });

    it('should return false for malformed hashes', () => {
      expect(isValidTxHash('1234')).toBe(false);
      expect(isValidTxHash('')).toBe(false);
      expect(isValidTxHash(validHash + 'g')).toBe(false);
    });
  });

  describe('formatStellarAddress & maskWalletAddress', () => {
    it('should format address with first and last 4 characters', () => {
      const formatted = formatStellarAddress(validKey, 4);
      expect(formatted).toBe('GAAZ...CWN7');
    });

    it('should handle short strings or invalid inputs', () => {
      expect(formatStellarAddress('')).toBe('');
      expect(formatStellarAddress('SHORT')).toBe('SHORT');
      expect(maskWalletAddress(validKey)).toBe('GAAZ...CWN7');
    });
  });
});
