/**
 * Register Page (Merged into Checkin)
 * Re-exports render from checkin.js for backwards compatibility.
 */
import { render as checkinRender } from './checkin.js';

export async function render(el, params = {}) {
  return checkinRender(el, { ...params, action: 'register' });
}
