import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseClient } from './firebase-client.js';
import { bootstrapUser } from './user-service.js';
import { describeAuthError } from './auth-errors.js';

/** Firebase authentication boundary for UI callers. */
export function createFirebaseAuthService() {
  let client;
  const getClient = () => {
    client ??= getFirebaseClient();
    return client;
  };

  return {
    /** @param {(state: { kind: 'signed-in', user: import('firebase/auth').User } | { kind: 'signed-out', message?: string }) => void} callback */
    subscribe(callback) {
      try {
        const { auth } = getClient();
        return onAuthStateChanged(auth, async (user) => {
          if (user) {
            try { await bootstrapUser(user.uid); }
            catch { callback({ kind: 'signed-out', message: 'Your account could not be prepared. Please try again.' }); return; }
          }
          callback(user ? { kind: 'signed-in', user } : { kind: 'signed-out' });
        }, (error) => callback({ kind: 'signed-out', message: describeAuthError(error, 'status') }));
      } catch {
        callback({ kind: 'signed-out', message: 'Sign-in is not configured on this site yet.' });
        return () => {};
      }
    },
    async signIn() {
      try {
        const { auth } = getClient();
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (error) { throw new Error(describeAuthError(error, 'sign-in')); }
    },
    async signOut() {
      try { await signOut(getClient().auth); }
      catch (error) { throw new Error(describeAuthError(error, 'sign-out')); }
    }
  };
}
