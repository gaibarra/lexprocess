/**
 * assertUniqueKeys test utility.
 *
 * Purpose:
 *  - Detect inadvertent duplicate React element keys early in tests.
 *  - Fails fast instead of only logging a console.error (which can be overlooked / suppressed).
 *
 * How it works:
 *  - Monkey‑patches console.error once per process (guarded by global.__UNIQUE_KEY_PATCHED__).
 *  - Captures messages containing the React warning "Encountered two children with the same key".
 *  - Tests call resetUniqueKeyLog() in beforeEach and assertUniqueKeys() after rendering critical UI.
 *
 * Opt‑out / Disable:
 *  - Remove calls to assertUniqueKeys() in tests you don't want enforced.
 *  - Or delete this file and any imports; warning reverts to standard console noise.
 *  - To temporarily silence while keeping the file, stub assertUniqueKeys to a no‑op.
 *
 * Notes:
 *  - Does not attempt deep tree inspection; relies on React's own detection.
 *  - Safe in CI; negligible overhead versus normal console error path.
 */

let duplicateKeyMessages = [];

const originalError = console.error;
if (!global.__UNIQUE_KEY_PATCHED__) {
  global.__UNIQUE_KEY_PATCHED__ = true;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && /Encountered two children with the same key/.test(args[0])) {
      duplicateKeyMessages.push(args[0]);
    }
    originalError(...args);
  };
}

export function resetUniqueKeyLog() { duplicateKeyMessages = []; }
export function getDuplicateKeyMessages() { return duplicateKeyMessages.slice(); }
export function assertUniqueKeys() {
  if (duplicateKeyMessages.length) {
    throw new Error('Duplicate React keys detected in render: ' + duplicateKeyMessages[0]);
  }
}
