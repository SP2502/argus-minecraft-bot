function classifyFailure(phase, message, code) {
  const reason = String(message ?? '').toLowerCase();
  if (/banned|blacklisted|whitelist|white-listed/.test(reason)) return { category: 'access', label: 'Server access rejected' };
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { category: 'dns', label: 'Hostname lookup failed' };
  if (/protocol version:\s*-1\b/.test(reason)) return { category: 'protocol', label: 'Server did not advertise a usable Minecraft version' };
  if (/outdated client|outdated server|unsupported.*protocol|unknown protocol|version mismatch/.test(reason)) {
    return { category: 'protocol', label: 'Minecraft version or protocol mismatch' };
  }
  if (phase === 'world' && /keep.?alive|timed out/.test(reason)) return { category: 'keepalive', label: 'World session timed out' };
  if (phase === 'transport' && (['ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ARGUS_STARTUP_TIMEOUT'].includes(code))) {
    return { category: 'transport', label: 'Minecraft port did not respond' };
  }
  if (code === 'ARGUS_STARTUP_TIMEOUT') return { category: 'startup', label: 'Minecraft startup timed out' };
  if (code === 'KICKED') return { category: 'kick', label: 'Server closed the session' };
  return { category: 'connection', label: 'Connection ended' };
}

module.exports = function createMinecraftDiagnostics(now = Date.now) {
  let current = { phase: 'idle', nextRetryAt: null, failure: null };
  return {
    begin(requestedVersion, authMode) {
      current = { phase: 'transport', startedAt: now(), requestedVersion, authMode, nextRetryAt: null, failure: null };
    },
    advance(phase, negotiatedVersion = current.negotiatedVersion) {
      current = { ...current, phase, negotiatedVersion };
    },
    fail(message, code) {
      current = { ...current, failure: classifyFailure(current.phase, message, code) };
    },
    scheduleRetry(delay) {
      current = { ...current, nextRetryAt: now() + delay };
    },
    clearRetry() {
      current = { ...current, nextRetryAt: null };
    },
    snapshot() {
      return { ...current };
    }
  };
};
