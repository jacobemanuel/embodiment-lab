import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import App from '@/App';

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('App smoke', () => {
  it('renders the welcome screen', () => {
    const { getByText, getByRole } = renderAt('/');
    expect(getByText(/AI Image Generation Study/i)).toBeInTheDocument();
    expect(getByRole('button', { name: /continue to consent/i })).toBeInTheDocument();
  });

  it('renders the consent screen', () => {
    const { getByText } = renderAt('/consent');
    expect(getByText(/Informed Consent/i)).toBeInTheDocument();
  });
});
