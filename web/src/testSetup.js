import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Pattern from the id-jag-standalone kit: Node's own localStorage global hides jsdom's; @xyflow/react needs a ResizeObserver.
if (typeof globalThis.localStorage?.clear !== 'function') Object.defineProperty(globalThis, 'localStorage', { value: globalThis.jsdom.window.localStorage, configurable: true });
if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (typeof globalThis.DOMMatrixReadOnly === 'undefined') globalThis.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-present'); try { localStorage.clear(); } catch { /* none */ } });
window.scrollTo = () => {}; // jsdom does not implement it
