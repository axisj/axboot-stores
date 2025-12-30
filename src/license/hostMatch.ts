export function normalizeHost(host: string) {
  return host.trim().toLowerCase();
}

export function isLocalHost(host: string) {
  // 포트 제거
  const h = host.split(':')[0];

  // localhost
  if (h === 'localhost') return true;

  // loopback
  if (h === '127.0.0.1' || h === '0.0.0.0') return true;

  // private network (192.168.x.x)
  return /^192\.168\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(h);
}

export function matchHost(host: string, hostPatterns: string[]): boolean {
  const h = normalizeHost(host);

  // ✅ 로컬 / 개발 환경은 무조건 허용
  if (isLocalHost(h)) return true;

  for (const raw of hostPatterns ?? []) {
    const p = normalizeHost(raw);
    if (!p) continue;

    // exact match
    if (!p.startsWith('*.')) {
      if (h === p) return true;
      continue;
    }

    // wildcard: "*.example.com" => suffix ".example.com"
    const suffix = p.slice(1); // ".example.com"
    if (h.endsWith(suffix)) {
      const left = h.slice(0, h.length - suffix.length);
      if (left.length > 0 && left.endsWith('.')) return true;
    }
  }

  return false;
}
