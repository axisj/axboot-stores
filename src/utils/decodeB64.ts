export function decodeB64Utf8(s: string) {
  const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
