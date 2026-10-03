import type { ZodType } from 'zod';
import { TOKEN_KEY } from '../auth/storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.map(String).join(', ');
    }
  }
  return `Request failed (${status})`;
}

export async function apiRequest<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init?.headers);
  if (init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Trim could not reach the API.');
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFromBody(body, response.status));
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, 'The server returned an unexpected response.');
  }
  return parsed.data;
}

export function apiGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  return apiRequest(path, schema, { method: 'GET' });
}

export function apiSend<T>(path: string, schema: ZodType<T>, payload: unknown): Promise<T> {
  return apiRequest(path, schema, { method: 'POST', body: JSON.stringify(payload) });
}
