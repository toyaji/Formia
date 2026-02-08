import { FormFactor } from '../core/schema';
import { Operation } from 'rfc6902';

export interface AIProvider {
  /**
   * Generates a sequence of JSON Patches based on a natural language prompt.
   */
  generatePatch(prompt: string, currentSchema: FormFactor): Promise<Operation[]>;

  /**
   * Returns a friendly name for the provider.
   */
  getName(): string;
}
