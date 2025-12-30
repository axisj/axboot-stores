import { base64urlToBytes, base64urlToString, concatUtf8 } from './base64url';
import { matchHost } from './hostMatch';
import type { LicenseHeader, LicensePayload, VerifyResult } from './types';

function pemToDer(pem: string): ArrayBuffer {
  const lines = pem.trim().split('\n');
  const b64 = lines.filter(l => !l.includes('BEGIN') && !l.includes('END')).join('');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;
let cachedPem: string | null = null;

async function importEd25519PublicKey(pem: string): Promise<CryptoKey> {
  const pemNorm = pem.trim();
  if (cachedKey && cachedPem === pemNorm) return cachedKey;

  const der = pemToDer(pemNorm);
  const key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
  cachedKey = key;
  cachedPem = pemNorm;
  return key;
}

export async function veLi(params: { ls: string; pk: string; ho?: string; nowMs?: number }): Promise<VerifyResult> {
  const ls = (params.ls ?? '').trim();
  const pk = (params.pk ?? '').trim();
  if (!ls || !pk) return { ok: false, reason: 'MALFORMED' };

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
    const key = await importEd25519PublicKey(pk);
    const data = concatUtf8(h64, p64);
    const sig = base64urlToBytes(s64);

    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, data);
    if (!ok) return { ok: false, reason: 'SIGNATURE_INVALID', header, payload };
  } catch {
    return { ok: false, reason: 'SIGNATURE_INVALID', header, payload };
  }

  // host match
  const host = params.ho ?? (typeof location !== 'undefined' ? location.hostname : undefined);

  if (host) {
    const okHost = matchHost(host, payload.hosts ?? []);
    if (!okHost) return { ok: false, reason: 'HOST_MISMATCH', header, payload };
  }

  return { ok: true, header, payload };
}
