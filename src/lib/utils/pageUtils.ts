/**
 * Generates a title for a default question page based on the current count.
 * @param existingQuestionPageCount Number of existing question pages
 * @returns Sequential title (e.g., "3페이지")
 */
export const generateQuestionPageTitle = (existingQuestionPageCount: number): string => {
  return `${existingQuestionPageCount + 1}페이지`;
};

/**
 * Generates a title for an ending page based on the current count.
 * @param existingEndingPageCount Number of existing ending pages
 * @returns Sequential title (e.g., "2 종료 페이지")
 */
export const generateEndingPageTitle = (existingEndingPageCount: number): string => {
  if (existingEndingPageCount === 0) return '종료 페이지';
  return `${existingEndingPageCount + 1} 종료 페이지`;
};
