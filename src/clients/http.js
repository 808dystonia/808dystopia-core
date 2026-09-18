// Retries are opt-in: never automatically replay a publishing mutation.
export async function fetchJson(url, options = {}, { retrySafe = false, attempts = 3, timeoutMs = 45000, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) }); }
    catch (error) {
      if (!retrySafe || attempt + 1 >= attempts) throw new Error('API request timed out or could not connect', { cause: error });
      await sleep(500 * 2 ** attempt); continue;
    }
    if (retrySafe && (response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
      const retryAfter = Number(response.headers?.get('retry-after'));
      await sleep(Math.min(10000, Math.max(500 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0))); continue;
    }
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    return response.json();
  }
}
