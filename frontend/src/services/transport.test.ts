import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './transport';

describe('binary bridge transport', () => {
  it('round-trips binary payloads larger than a spread-call chunk', () => {
    const bytes = new Uint8Array(100_000);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 37) & 0xff;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
