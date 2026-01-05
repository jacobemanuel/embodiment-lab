import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Extend Vitest expect with jest-dom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toHaveClass(className: string): T;
    toHaveAttribute(attr: string, value?: string): T;
    toBeVisible(): T;
    toBeDisabled(): T;
    toHaveTextContent(text: string | RegExp): T;
    toHaveValue(value: string | number | string[]): T;
  }
}

// Mock window.matchMedia for responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  root: Element | null = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
