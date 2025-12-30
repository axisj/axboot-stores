export interface LicenseHeader {
  alg: 'EdDSA';
  typ: 'AXL';
  v: 1;
  kid: string;
}

export interface LicensePayload {
  v: 1;
  iss: 'AXISJ';
  sub: string;
  name: string;
  prd: string;
  plan: string;
  hosts: string[];
  iat: number;
  exp?: number;
  nonce: string;
}

export type LicenseInvalidReason = 'MALFORMED' | 'UNSUPPORTED_ALG' | 'SIGNATURE_INVALID' | 'EXPIRED' | 'HOST_MISMATCH';

export interface VerifyResult {
  ok: boolean;
  reason?: LicenseInvalidReason;
  header?: LicenseHeader;
  payload?: LicensePayload;
}
