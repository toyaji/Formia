import { FormFactor } from '../core/schema';
import { FormInfo, FormRepository } from '../core/repository';

/**
 * Cloud API Repository — 웹 클라이언트용 FormRepository 구현체
 *
 * Next.js API Routes를 통해 서버의 DB와 통신합니다.
 * 인증은 NextAuth 세션 쿠키가 자동으로 포함됩니다.
 */
export class CloudAPIRepository implements FormRepository {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/forms') {
    this.baseUrl = baseUrl;
  }

  async save(id: string, content: FormFactor): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factor: content }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to save form: ${response.status}`);
    }
  }

  async load(id: string): Promise<FormFactor> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to load form: ${response.status}`);
    }

    const data = await response.json();
    return data.factor;
  }

  async list(): Promise<FormInfo[]> {
    const response = await fetch(this.baseUrl);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to list forms: ${response.status}`);
    }

    const forms = await response.json();
    return forms.map((form: any) => ({
      id: form.id,
      title: form.title,
      updatedAt: form.updatedAt,
    }));
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to delete form: ${response.status}`);
    }
  }
}
