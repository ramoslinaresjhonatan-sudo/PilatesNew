export const MEMBERSHIP_PLANS_UPDATED_EVENT = 'pilates-house:membership-plans-updated';
const MEMBERSHIP_PLANS_UPDATED_KEY = 'pilates-house:membership-plans-updated-at';

/** Notifies the public landing in this or another browser tab after a plan change. */
export function notifyMembershipPlansUpdated() {
  if (typeof window === 'undefined') return;

  const timestamp = String(Date.now());
  try {
    window.localStorage.setItem(MEMBERSHIP_PLANS_UPDATED_KEY, timestamp);
  } catch {
    // The in-page event still refreshes the landing when storage is unavailable.
  }
  window.dispatchEvent(new Event(MEMBERSHIP_PLANS_UPDATED_EVENT));
}

export function isMembershipPlansStorageEvent(event: StorageEvent) {
  return event.key === MEMBERSHIP_PLANS_UPDATED_KEY;
}
