import { api, setAccessToken } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface LoginResult {
  user: AuthUser;
  accessToken: string;
}

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

function productMessage(status: number, serverMessage: string | null): string {
  if (serverMessage && status === 400) return serverMessage;
  switch (status) {
    case 401:
      return 'Email or password is incorrect.';
    case 409:
      return 'An account with this email already exists. Sign in instead.';
    case 404:
      return 'That request could not be found. Try again.';
    default:
      if (status >= 500) return 'Something went wrong. Please try again.';
      return serverMessage ?? 'Something went wrong. Please try again.';
  }
}

function handleResponse<T>(res: { data?: unknown; error?: unknown; response: Response }): T {
  if (!res.response.ok) {
    const errorBody = res.error as { error?: { message?: string } };
    throw new AuthApiError(
      res.response.status,
      productMessage(res.response.status, errorBody?.error?.message ?? null),
    );
  }

  const envelope = res.data as { success: boolean; data: T; error: unknown; meta: unknown };
  if (!envelope?.success) {
    throw new AuthApiError(
      res.response.status,
      productMessage(
        res.response.status,
        (envelope?.error as { message?: string })?.message ?? null,
      ),
    );
  }
  return envelope.data;
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const res = await api.POST('/api/v1/auth/login', {
    body: { email, password },
  });
  const data = handleResponse<{ user: AuthUser; tokens: { accessToken: string } }>(res);
  setAccessToken(data.tokens.accessToken);
  return { user: data.user, accessToken: data.tokens.accessToken };
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function registerRequest(payload: RegisterPayload): Promise<LoginResult> {
  const res = await api.POST('/api/v1/auth/register', {
    body: payload,
  });
  const data = handleResponse<{ user: AuthUser; tokens: { accessToken: string } }>(res);
  setAccessToken(data.tokens.accessToken);
  return { user: data.user, accessToken: data.tokens.accessToken };
}

let refreshPromise: Promise<string> | null = null;

export async function refreshRequest(): Promise<string> {
  // 1. If a request is already happening, return that exact same promise
  // instead of making a new network call.

  if (refreshPromise) {
    return refreshPromise;
  }

  // 2. Otherwise, start a ne()w request and store the promise

  refreshPromise = (async () => {
    try {
      const res = await api.POST('/api/v1/auth/refresh');
      const data = handleResponse<{ tokens: { accessToken: string } }>(res);
      setAccessToken(data.tokens.accessToken);
      return data.tokens.accessToken;
    } finally {
      // 3. CRITICAL: Clear the promise when it finishes (whether success or error)
      // so that future refresh requests aren't blocked forever.
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function logoutRequest(): Promise<void> {
  const res = await api.POST('/api/v1/auth/logout');
  handleResponse<null>(res);
  setAccessToken(null);
}

export async function meRequest(): Promise<{ user: AuthUser }> {
  const res = await api.GET('/api/v1/auth/me');
  return handleResponse<{ user: AuthUser }>(res);
}
