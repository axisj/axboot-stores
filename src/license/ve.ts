import { base64urlToBytes, base64urlToString, concatUtf8 } from './base64url';
import { isLocalHost, matchHost, normalizeHost } from './hostMatch';
import type { LicenseHeader, LicensePayload, VerifyResult } from './types';

// --- noble (HTTP fallback) ---
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// noble ed25519: sha512 주입(최신 v3 방식)
ed25519.hashes.sha512 = sha512;
ed25519.hashes.sha512Async = async (m: Uint8Array) => sha512(m);

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

function pemToDerBytes(pem: string): Uint8Array {
  // (선택) SSR 안전장치: 서버에서 호출되면 바로 실패시켜 noble/webcrypto 둘 다 건너뛰도록 할 수 있음
  if (typeof atob === 'undefined') {
    throw new Error('atob is not available (non-browser environment)');
  }

  const lines = pem.trim().split('\n');
  const b64 = lines.filter(l => !l.includes('BEGIN') && !l.includes('END')).join('');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// WebCrypto cache
let cachedKey: CryptoKey | null = null;
let cachedPem: string | null = null;

async function importEd25519PublicKeyWebCrypto(pem: string): Promise<CryptoKey> {
  const pemNorm = pem.trim();
  if (cachedKey && cachedPem === pemNorm) return cachedKey;

  const derBytes = pemToDerBytes(pemNorm);

  // ✅ derBytes.buffer 대신 toArrayBuffer(derBytes)
  const key = await crypto.subtle.importKey('spki', toArrayBuffer(derBytes), { name: 'Ed25519' }, false, ['verify']);

  cachedKey = key;
  cachedPem = pemNorm;
  return key;
}

/**
 * SPKI DER에서 Ed25519 공개키(32 bytes)를 추출.
 */
function extractEd25519PublicKeyFromSpkiDer(spkiDer: Uint8Array): Uint8Array {
  const bytes = spkiDer;

  let bitStringIdx = -1;
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] === 0x03) {
      bitStringIdx = i;
      break;
    }
  }
  if (bitStringIdx < 0) throw new Error('SPKI: BIT STRING not found');

  const lenInfo = readDerLength(bytes, bitStringIdx + 1);
  const bitStringLen = lenInfo.len;
  const bitStringContentStart = lenInfo.next;

  if (bitStringLen < 1 + 32) throw new Error('SPKI: BIT STRING too short');
  const unusedBits = bytes[bitStringContentStart];
  if (unusedBits !== 0x00) throw new Error('SPKI: unexpected unused bits');

  const keyStart = bitStringContentStart + 1;
  const key = bytes.slice(keyStart, keyStart + 32);
  if (key.length !== 32) throw new Error('SPKI: invalid key length');

  return key;
}

function readDerLength(bytes: Uint8Array, offset: number): { len: number; next: number } {
  const first = bytes[offset];
  if (first == null) throw new Error('DER: length missing');

  if ((first & 0x80) === 0) {
    return { len: first, next: offset + 1 };
  }

  const n = first & 0x7f;
  if (n === 0 || n > 4) throw new Error('DER: invalid length');
  let len = 0;
  for (let i = 0; i < n; i++) {
    len = (len << 8) | bytes[offset + 1 + i];
  }
  return { len, next: offset + 1 + n };
}

function canUseWebCryptoEd25519(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof isSecureContext !== 'undefined' && isSecureContext;
}

async function verifyEd25519Signature(params: { pkPem: string; data: Uint8Array; sig: Uint8Array }): Promise<boolean> {
  const { pkPem, data, sig } = params;

  if (canUseWebCryptoEd25519()) {
    try {
      const key = await importEd25519PublicKeyWebCrypto(pkPem);
      return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, data);
    } catch {
      // fallthrough to noble
    }
  }

  const der = pemToDerBytes(pkPem);
  const pubKey32 = extractEd25519PublicKeyFromSpkiDer(der);
  return await ed25519.verify(sig, data, pubKey32);
}

export async function veLi(params: { ls: string; pk: string; ho?: string; nowMs?: number }): Promise<VerifyResult> {
  const ls = (params.ls ?? '').trim();
  const pk = (params.pk ?? '').trim();

  const host = params.ho ?? (typeof location !== 'undefined' ? location.hostname : undefined);
  if (!ls || !pk) return { ok: false, reason: 'MALFORMED' };

  const h = normalizeHost(host ?? '');
  if (isLocalHost(h)) {
    return { ok: true, header: undefined, payload: undefined };
  }

  const parts = ls.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'MALFORMED' };

  const [h64, p64, s64] = parts;

  let header: LicenseHeader;
  let payload: LicensePayload;

  try {
    header = JSON.parse(base64urlToString(h64));
    payload = JSON.parse(base64urlToString(p64));
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  if (header?.alg !== 'EdDSA' || header?.typ !== 'AXL') {
    return { ok: false, reason: 'UNSUPPORTED_ALG' };
  }

  if (!payload || !Array.isArray(payload.hosts)) {
    return { ok: false, reason: 'MALFORMED', header, payload };
  }

  const now = params.nowMs ?? Date.now();
  if (typeof payload.exp === 'number' && now > payload.exp) {
    return { ok: false, reason: 'EXPIRED', header, payload };
  }

  try {
    const data = concatUtf8(h64, p64); // `${h64}.${p64}`
    const sig = base64urlToBytes(s64);

    const ok = await verifyEd25519Signature({ pkPem: pk, data, sig });
    if (!ok) return { ok: false, reason: 'SIGNATURE_INVALID', header, payload };
  } catch (e) {
    // console.error('Error during signature verification', e);
    return { ok: false, reason: 'SIGNATURE_INVALID', header, payload };
  }

  if (host) {
    const okHost = matchHost(host, payload.hosts ?? []);
    if (!okHost) return { ok: false, reason: 'HOST_MISMATCH', header, payload };
  }

  return { ok: true, header, payload };
}
