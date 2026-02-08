import { FormFactor } from './schema';

export interface FormInfo {
  id: string;
  title: string;
  updatedAt: string;
}

export interface FormRepository {
  /**
   * Saves the entire Form Factor to a persistent storage.
   */
  save(id: string, content: FormFactor): Promise<void>;

  /**
   * Loads a Form Factor by its identifier.
   */
  load(id: string): Promise<FormFactor>;

  /**
   * Lists all available forms in the storage.
   */
  list(): Promise<FormInfo[]>;

  /**
   * Deletes a form from storage.
   */
  delete(id: string): Promise<void>;
}
