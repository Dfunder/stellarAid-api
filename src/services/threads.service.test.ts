import { MESSAGE_MAX_LENGTH } from './threads.service';

describe('threads service (#838)', () => {
  it('enforces max message length constant', () => {
    expect(MESSAGE_MAX_LENGTH).toBe(5000);
  });
});
