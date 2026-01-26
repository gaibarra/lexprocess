// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import './testUtils/silenceConsole';
import { resetUniqueKeyLog, assertUniqueKeys } from './testUtils/assertUniqueKeys';

// Use manual axios mock for all tests
jest.mock('axios');

// Global enforcement of unique React element keys.
// Opt-out by running tests with ALLOW_DUP_KEYS=1
beforeEach(() => {
	if (process.env.ALLOW_DUP_KEYS !== '1') {
		resetUniqueKeyLog();
	}
});

afterEach(() => {
	if (process.env.ALLOW_DUP_KEYS !== '1') {
		assertUniqueKeys();
	}
});
