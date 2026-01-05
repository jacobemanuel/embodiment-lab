import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { 
  createStudySession, 
  saveDemographics, 
  savePreTestResponses,
  savePostTestResponses,
  completeStudySession 
} from '../studyData';

describe('studyData functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStudySession', () => {
    it('calls edge function with correct parameters for text mode', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { sessionId: 'test-session-123' },
        error: null,
      });

      const result = await createStudySession('text');

      expect(mockInvoke).toHaveBeenCalledWith('save-study-data', {
        body: {
          action: 'create_session',
          mode: 'text',
        },
      });
      expect(result).toBe('test-session-123');
    });

    it('calls edge function with correct parameters for avatar mode', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { sessionId: 'avatar-session-456' },
        error: null,
      });

      const result = await createStudySession('avatar');

      expect(mockInvoke).toHaveBeenCalledWith('save-study-data', {
        body: {
          action: 'create_session',
          mode: 'avatar',
        },
      });
      expect(result).toBe('avatar-session-456');
    });

    it('throws error when edge function fails', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('Network error'),
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);
      const randomSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('fallback-session-123');

      await expect(createStudySession('text')).resolves.toBe('fallback-session-123');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'fallback-session-123',
        mode: 'text',
        status: 'active',
      }));

      randomSpy.mockRestore();
    });

    it('throws error when data contains error', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { error: 'Session creation failed' },
        error: null,
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);
      const randomSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('fallback-session-456');

      await expect(createStudySession('text')).resolves.toBe('fallback-session-456');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'fallback-session-456',
        mode: 'text',
        status: 'active',
      }));

      randomSpy.mockRestore();
    });
  });

  describe('saveDemographics', () => {
    it('calls edge function with correct parameters', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      const demographics = {
        'demo-age': '25',
        'demo-education': "Bachelor's degree",
      };

      await saveDemographics('session-123', demographics);

      expect(mockInvoke).toHaveBeenCalledWith('save-study-data', {
        body: {
          action: 'save_demographics',
          sessionId: 'session-123',
          demographics,
        },
      });
    });
  });

  describe('savePreTestResponses', () => {
    it('transforms responses to correct format', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      const responses = {
        'pre-1': 'Answer A',
        'pre-2': 'Answer B',
      };

      await savePreTestResponses('session-123', responses);

      expect(mockInvoke).toHaveBeenCalledWith('save-study-data', {
        body: {
          action: 'save_pre_test',
          sessionId: 'session-123',
          preTestResponses: [
            { questionId: 'pre-1', answer: 'Answer A' },
            { questionId: 'pre-2', answer: 'Answer B' },
          ],
        },
      });
    });
  });

  describe('savePostTestResponses', () => {
    it('transforms responses to correct format', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      const responses = {
        'post-1': 'Answer X',
        'post-2': 'Answer Y',
      };

      await savePostTestResponses('session-123', responses);

      expect(mockInvoke).toHaveBeenCalledWith('save-study-data', {
        body: {
          action: 'save_post_test',
          sessionId: 'session-123',
          postTestResponses: [
            { questionId: 'post-1', answer: 'Answer X' },
            { questionId: 'post-2', answer: 'Answer Y' },
          ],
        },
      });
    });
  });

  describe('completeStudySession', () => {
    it('calls complete-session edge function', async () => {
      const mockInvoke = vi.mocked(supabase.functions.invoke);
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      await completeStudySession('session-123');

      expect(mockInvoke).toHaveBeenCalledWith('complete-session', {
        body: { sessionId: 'session-123' },
      });
    });
  });
});
