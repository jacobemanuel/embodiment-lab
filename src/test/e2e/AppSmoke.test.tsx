import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    renderAt('/');
    expect(screen.getByText(/AI Image Generation Study/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to consent/i })).toBeInTheDocument();
  });

  it('renders the consent screen', () => {
    renderAt('/consent');
    expect(screen.getByText(/Informed Consent/i)).toBeInTheDocument();
  });
});
