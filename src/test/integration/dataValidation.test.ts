import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Integration tests for data validation schemas
 * Tests the validation logic used in edge functions and forms
 */

describe('Data Validation Schemas', () => {
  describe('Avatar Time Validation', () => {
    const avatarTimeSchema = z.object({
      sessionId: z.string().min(10).max(100),
      slideId: z.string().min(1).max(100),
      slideTitle: z.string().max(500).optional(),
      startedAt: z.string().datetime().optional(),
      endedAt: z.string().datetime().optional(),
      durationSeconds: z.number().min(0).max(7200).optional(),
    });

    it('accepts valid avatar time data', () => {
      const validData = {
        sessionId: 'session-12345678',
        slideId: 'slide-1',
        slideTitle: 'Introduction',
        durationSeconds: 120,
      };

      const result = avatarTimeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects sessionId that is too short', () => {
      const invalidData = {
        sessionId: 'short',
        slideId: 'slide-1',
      };

      const result = avatarTimeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects negative duration', () => {
      const invalidData = {
        sessionId: 'session-12345678',
        slideId: 'slide-1',
        durationSeconds: -5,
      };

      const result = avatarTimeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects duration exceeding 2 hours', () => {
      const invalidData = {
        sessionId: 'session-12345678',
        slideId: 'slide-1',
        durationSeconds: 8000, // > 7200 (2 hours)
      };

      const result = avatarTimeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts valid datetime formats', () => {
      const validData = {
        sessionId: 'session-12345678',
        slideId: 'slide-1',
        startedAt: '2024-01-15T10:30:00Z',
        endedAt: '2024-01-15T10:35:00Z',
      };

      const result = avatarTimeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Study Response Validation', () => {
    const responseSchema = z.object({
      questionId: z.string().min(1).max(50),
      answer: z.string().min(1).max(5000),
    });

    it('accepts valid response', () => {
      const validData = {
        questionId: 'pre-1',
        answer: 'Selected answer A',
      };

      const result = responseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects empty questionId', () => {
      const invalidData = {
        questionId: '',
        answer: 'Some answer',
      };

      const result = responseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects empty answer', () => {
      const invalidData = {
        questionId: 'pre-1',
        answer: '',
      };

      const result = responseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Demographics Validation', () => {
    const demographicsSchema = z.record(z.string(), z.string().max(500));

    it('accepts valid demographics data', () => {
      const validData = {
        'demo-age': '25',
        'demo-education': "Bachelor's degree",
        'demo-digital-experience': '3 - Moderate Experience',
      };

      const result = demographicsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects values that are too long', () => {
      const invalidData = {
        'demo-age': 'a'.repeat(501),
      };

      const result = demographicsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Open Feedback Validation', () => {
    const feedbackSchema = z.object({
      questionId: z.string(),
      response: z.string().max(200),
      skipped: z.boolean(),
    });

    it('accepts valid feedback', () => {
      const validData = {
        questionId: 'open_liked',
        response: 'The avatar was helpful and engaging',
        skipped: false,
      };

      const result = feedbackSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts skipped feedback', () => {
      const validData = {
        questionId: 'open_frustrating',
        response: '',
        skipped: true,
      };

      const result = feedbackSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects response exceeding 200 characters', () => {
      const invalidData = {
        questionId: 'open_improvement',
        response: 'a'.repeat(201),
        skipped: false,
      };

      const result = feedbackSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
