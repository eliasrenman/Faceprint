const chunkSize = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function arrayBufferToBase64(value: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(value));
}

export function base64ToArrayBuffer(value: string): ArrayBuffer {
  return base64ToBytes(value).buffer as ArrayBuffer;
}
