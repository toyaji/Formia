import { describe, it, expect } from 'vitest';
import { generateQuestionPageTitle, generateEndingPageTitle } from './pageUtils';

describe('pageUtils', () => {
  describe('generateQuestionPageTitle', () => {
    it('should generate "1페이지" for the first question page', () => {
      expect(generateQuestionPageTitle(0)).toBe('1페이지');
    });

    it('should generate "3페이지" when 2 question pages exist', () => {
      expect(generateQuestionPageTitle(2)).toBe('3페이지');
    });
  });

  describe('generateEndingPageTitle', () => {
    it('should generate "종료 페이지" for the first ending page', () => {
      expect(generateEndingPageTitle(0)).toBe('종료 페이지');
    });

    it('should generate "2 종료 페이지" when 1 ending page exists', () => {
      expect(generateEndingPageTitle(1)).toBe('2 종료 페이지');
    });

    it('should generate "3 종료 페이지" when 2 ending pages exist', () => {
      expect(generateEndingPageTitle(2)).toBe('3 종료 페이지');
    });
  });
});
