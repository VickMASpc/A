/** @typedef {{ kind: 'loading' } | { kind: 'signed-out', message?: string } | { kind: 'signed-in', user: { uid: string, displayName?: string | null, email?: string | null } }} AuthState */

/** @param {{ subscribe: (callback: (state: AuthState) => void) => () => void, signIn: () => Promise<void>, signOut: () => Promise<void> }} service @param {(state: AuthState & { busy?: 'sign-in' | 'sign-out', message?: string }) => void} render */
export function createAuthController(service, render) {
  let stop = () => {};
  let busy = false;
  let state = /** @type {AuthState} */ ({ kind: 'loading' });
  const emit = (extra = {}) => render({ ...state, ...extra });
  return {
    start() { stop = service.subscribe((next) => { state = next; emit(); }); },
    destroy() { stop(); },
    async signIn() {
      if (busy) return;
      busy = true;
      emit({ busy: 'sign-in' });
      try { await service.signIn(); }
      catch (error) { emit({ message: error instanceof Error && error.message === 'Sign-in was cancelled.' ? error.message : 'We could not sign you in. Please try again.' }); }
      finally { busy = false; }
    },
    async signOut() {
      if (busy) return;
      busy = true;
      emit({ busy: 'sign-out' });
      try { await service.signOut(); }
      catch { emit({ message: 'We could not sign you out. Please try again.' }); }
      finally { busy = false; }
    }
  };
}
