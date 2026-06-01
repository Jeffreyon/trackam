/**
 * Persistent verify tokens for the public tracking page.
 *
 * After a sender / receiver completes the OTP flow on `/track/:id`, the
 * frontend stashes the 7-day JWT here keyed by waybillId so that revisits
 * skip the OTP step and land straight on the verified chain view.
 *
 * One token per waybill — different recipients can verify on different
 * devices without colliding.
 */

const PREFIX = "trackam:waybillVerify:";

interface SavedToken {
  token: string;
  role:  "sender" | "receiver";
  expiresAt: string;  // ISO
}

export function saveVerifyToken(waybillId: string, payload: SavedToken): void {
  try { localStorage.setItem(PREFIX + waybillId, JSON.stringify(payload)); } catch { /* private mode */ }
}

export function getVerifyToken(waybillId: string): SavedToken | null {
  try {
    const raw = localStorage.getItem(PREFIX + waybillId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedToken;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(PREFIX + waybillId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearVerifyToken(waybillId: string): void {
  try { localStorage.removeItem(PREFIX + waybillId); } catch { /* ignore */ }
}
