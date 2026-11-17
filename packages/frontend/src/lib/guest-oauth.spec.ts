import { afterEach, describe, expect, it } from 'vitest';

import { guestCallbackClientId, SPOTIFY_STATE_KEY } from './guest-oauth';

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('guest OAuth resumption', () => {
  it('resumes only a matching, unexpired guest callback', () => {
    const clientId = '0123456789abcdef0123456789abcdef';
    const request = { guest: true, clientId, state: 'expected', expiresAt: Date.now() + 60_000 };
    sessionStorage.setItem(SPOTIFY_STATE_KEY, JSON.stringify(request));
    expect(guestCallbackClientId()).toBe('');
    window.history.replaceState({}, '', '/?code=test&state=expected');
    expect(guestCallbackClientId()).toBe(clientId);
    window.history.replaceState({}, '', '/?code=test&state=wrong');
    expect(guestCallbackClientId()).toBe('');
    window.history.replaceState({}, '', '/?error=access_denied&state=expected');
    expect(guestCallbackClientId()).toBe(clientId);
    sessionStorage.setItem(SPOTIFY_STATE_KEY, JSON.stringify({ ...request, expiresAt: 0 }));
    expect(guestCallbackClientId()).toBe('');
    sessionStorage.setItem(SPOTIFY_STATE_KEY, JSON.stringify({ ...request, guest: false }));
    expect(guestCallbackClientId()).toBe('');
  });

  it('does not resume malformed metadata', () => {
    window.history.replaceState({}, '', '/?code=test&state=expected');
    sessionStorage.setItem(SPOTIFY_STATE_KEY, '{bad-json');
    expect(guestCallbackClientId()).toBe('');
    sessionStorage.setItem(SPOTIFY_STATE_KEY, 'null');
    expect(guestCallbackClientId()).toBe('');
  });
});
