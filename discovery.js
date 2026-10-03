let cachedCandidates = null;

function normalizeCandidate(item) {
  if (!item || typeof item !== 'object') return null;

  let id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!id && typeof item.url === 'string') {
    try {
      const url = new URL(item.url);
      if (url.hostname === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if (url.searchParams.get('v')) id = url.searchParams.get('v') || '';
      else {
        const parts = url.pathname.split('/').filter(Boolean);
        const marker = parts.findIndex(part => part === 'shorts' || part === 'embed');
        if (marker >= 0) id = parts[marker + 1] || '';
      }
    } catch (_) {}
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return { ...item, id };
}

async function loadCandidates(force = false) {
  if (cachedCandidates && !force) return cachedCandidates;

  const response = await fetch('./candidates.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load candidates.json (${response.status}).`);
  }

  const payload = await response.json();
  const raw = Array.isArray(payload) ? payload : payload?.candidates;
  if (!Array.isArray(raw)) {
    throw new Error('candidates.json must be an array or an object with a candidates array.');
  }

  const unique = new Map();
  for (const item of raw) {
    const normalized = normalizeCandidate(item);
    if (normalized && !unique.has(normalized.id)) unique.set(normalized.id, normalized);
  }

  cachedCandidates = [...unique.values()];
  return cachedCandidates;
}

export async function getCandidates(limit = null, options = {}) {
  // Backwards-compatible with getCandidates({ reset: true }).
  if (limit && typeof limit === 'object') {
    options = limit;
    limit = null;
  }

  const pool = await loadCandidates(Boolean(options?.reset));
  if (limit == null) return [...pool];

  const count = Math.max(0, Math.floor(Number(limit) || 0));
  if (!count || count >= pool.length) return [...pool];

  // Only the returned subset is shuffled. The feed itself chooses each swipe
  // independently at random, so this does not create a hidden traversal order.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export async function refreshCandidateStats() {
  const pool = await loadCandidates(true);
  return { count: pool.length };
}
