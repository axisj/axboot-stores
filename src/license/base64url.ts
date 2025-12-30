export function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const s = b64 + pad;

  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64urlToString(b64url: string): string {
  const bytes = base64urlToBytes(b64url);
  // utf-8 decode
  return new TextDecoder().decode(bytes);
}

export function concatUtf8(a: string, b: string): Uint8Array {
  return new TextEncoder().encode(`${a}.${b}`);
}
