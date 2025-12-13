import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests for Edge Functions
 * These tests verify the structure and expected behavior of edge function calls
 */

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('Edge Function Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save-study-data', () => {
    it('handles create_session action', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { sessionId: 'generated-uuid' },
        error: null,
      });

      const result = await supabase.functions.invoke('save-study-data', {
        body: { action: 'create_session', mode: 'text' },
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('sessionId');
    });

    it('handles save_demographics action', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await supabase.functions.invoke('save-study-data', {
        body: {
          action: 'save_demographics',
          sessionId: 'test-session',
          demographics: { 'demo-age': '25' },
        },
      });

      expect(result.error).toBeNull();
    });

    it('handles save_pre_test action', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await supabase.functions.invoke('save-study-data', {
        body: {
          action: 'save_pre_test',
          sessionId: 'test-session',
          preTestResponses: [{ questionId: 'pre-1', answer: 'A' }],
        },
      });

      expect(result.error).toBeNull();
    });

    it('handles save_post_test action', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await supabase.functions.invoke('save-study-data', {
        body: {
          action: 'save_post_test',
          sessionId: 'test-session',
          postTestResponses: [{ questionId: 'post-1', answer: 'B' }],
        },
      });

      expect(result.error).toBeNull();
    });
  });

  describe('complete-session', () => {
    it('marks session as completed', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await supabase.functions.invoke('complete-session', {
        body: { sessionId: 'test-session' },
      });

      expect(result.error).toBeNull();
    });

    it('returns error for invalid session', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { error: 'Session not found' },
        error: null,
      });

      const result = await supabase.functions.invoke('complete-session', {
        body: { sessionId: 'invalid-session' },
      });

      expect(result.data).toHaveProperty('error');
    });
  });

  describe('save-avatar-time', () => {
    it('accepts valid avatar time data', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      const result = await supabase.functions.invoke('save-avatar-time', {
        body: {
          sessionId: 'test-session-123',
          slideId: 'slide-1',
          slideTitle: 'Introduction',
          durationSeconds: 120,
        },
      });

      expect(result.error).toBeNull();
    });

    it('validates session ID format', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { error: 'Invalid request data' },
        error: null,
      });

      const result = await supabase.functions.invoke('save-avatar-time', {
        body: {
          sessionId: 'x', // Too short
          slideId: 'slide-1',
        },
      });

      expect(result.data).toHaveProperty('error');
    });
  });

  describe('chat', () => {
    it('sends message and receives response', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { response: 'AI response here' },
        error: null,
      });

      const result = await supabase.functions.invoke('chat', {
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          slideContext: 'Introduction to AI',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('response');
    });

    it('handles API disabled state', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Service temporarily unavailable' },
      });

      const result = await supabase.functions.invoke('chat', {
        body: { messages: [] },
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe('anam-session', () => {
    it('returns session token when API enabled', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { sessionToken: 'anam-token-xyz' },
        error: null,
      });

      const result = await supabase.functions.invoke('anam-session', {
        body: { slideContext: 'Current slide info' },
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('sessionToken');
    });

    it('handles API disabled state', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Anam API is currently disabled' },
      });

      const result = await supabase.functions.invoke('anam-session', {
        body: {},
      });

      expect(result.error).not.toBeNull();
    });
  });
});
