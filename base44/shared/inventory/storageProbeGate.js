/** A cached runtime setting must not leave diagnostics enabled indefinitely.
 * Value: test-only|issued Unix milliseconds|expires Unix milliseconds.
 */
export function isStorageProbeAllowed(value, now = Date.now()) {
    if (typeof value !== 'string' || !Number.isSafeInteger(now)) return false;
    const match = /^test-only\|(\d{13})\|(\d{13})$/.exec(value);
    if (!match) return false;
    const issued = Number(match[1]);
    const expires = Number(match[2]);
    return expires > issued && expires - issued <= 15 * 60 * 1000 && issued <= now && now < expires;
}
