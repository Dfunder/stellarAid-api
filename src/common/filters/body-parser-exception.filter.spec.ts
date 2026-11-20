import { isBodyParserError } from './body-parser-exception.filter';

describe('isBodyParserError', () => {
  it('recognises body-parser error types', () => {
    expect(isBodyParserError({ type: 'entity.too.large' })).toBe(true);
    expect(isBodyParserError({ type: 'entity.parse.failed' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isBodyParserError(new Error('boom'))).toBe(false);
    expect(isBodyParserError(null)).toBe(false);
  });
});
