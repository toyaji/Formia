import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';
import { Message } from '@/store/useFormStore';

export interface AIProvider {
  /**
   * Generates a sequence of JSON Patches based on a natural language prompt and chat history.
   */
  generatePatch(prompt: string, currentSchema: FormFactor, messages?: Message[]): Promise<Operation[]>;

  /**
   * Returns a friendly name for the provider.
   */
  getName(): string;
}
