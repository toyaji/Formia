import { AIProvider } from './AIProvider';
import { FormFactor, BlockType } from '../core/schema';
import { Operation } from 'rfc6902';

export class GeminiProvider implements AIProvider {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    // [PLACEHOLDER] In a real app, this would be retrieved from secure storage or .env
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
  }

  getName(): string {
    return 'Google Gemini';
  }

  async generatePatch(prompt: string, currentSchema: FormFactor): Promise<Operation[]> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please provide it in settings.');
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: this.buildPrompt(prompt, currentSchema) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Gemini API request failed');
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('No response from Gemini');
      }

      // Gemini sometimes wraps result in markdown code blocks
      const cleanJson = textResponse.replace(/```json\n?|```/g, '').trim();
      const patches = JSON.parse(cleanJson);

      if (!Array.isArray(patches)) {
        throw new Error('AI returned invalid patch format (not an array)');
      }

      return patches as Operation[];
    } catch (error: any) {
      console.error('[Gemini] Integration Error:', error);
      throw error;
    }
  }

  private buildPrompt(userPrompt: string, schema: FormFactor): string {
    return `
You are a "JSON Patch Architect" specialized in Form Design.
Your task is to generate an RFC 6902 JSON Patch array to transform the provided "Form Factor" schema based on user intent.

### FORM FACTOR SCHEMA RULES:
- version: "2.0.0"
- pages: An array of page objects.
  - id: Unique string
  - title: (optional)
  - blocks: An array of block objects.
    - type: 'text' | 'choice' | 'rating' | 'info' | 'textarea' | 'date' | 'file'
    - id: Unique string (random)
    - content:
      - label: (required for input types)
      - placeholder: (optional)
      - options: (required for choice, array of strings)
      - maxRating: (required for rating, number 1-10)
      - body: (required for info, markdown string)

### OUTPUT SPECIFICATION:
- MUST return ONLY a valid JSON array of JSON Patch operations (op, path, value/from).
- Do NOT provide any explanation outside the JSON.
- Operations should target the "/pages/n/blocks/m" path.
- For new blocks, generate a unique random string for "id".
- If the user wants to add a page, target "/pages/-".

### CURRENT SCHEMA:
${JSON.stringify(schema, null, 2)}

### USER REQUEST:
"${userPrompt}"

JSON Patch Result:`.trim();
  }
}
