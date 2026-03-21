/**
 * useTelegramAuth.ts
 *
 * React-хук для авторизации через Telegram WebApp.
 * Вызывается один раз при монтировании приложения.
 *
 * Использование:
 *   const { user, isLoading, error } = useTelegramAuth();
 */
import { useState, useEffect, useCallback } from 'react';

// Типы Telegram WebApp SDK
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData:  string;
        initDataUnsafe: { user?: { id: number; first_name: string } };
        ready:     () => void;
        expand:    () => void;
        close:     () => void;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
      };
    };
  }
}

export interface AuthUser {
  id:           number;
  telegramId:   string;
  displayName:  string;
  role:         'client' | 'manager' | 'admin';
  companyId:    number | null;
  languageCode: string;
}

interface AuthState {
  user:       AuthUser | null;
  isLoading:  boolean;
  error:      string | null;
  accessToken: string | null;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.cleanshop.eu';

// Простое in-memory хранилище токенов (не localStorage — TMA не поддерживает)
let _accessToken:  string | null = null;
let _refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function useTelegramAuth() {
  const [state, setState] = useState<AuthState>({
    user:        null,
    isLoading:   true,
    error:       null,
    accessToken: null,
  });

  const login = useCallback(async () => {
    const twa = window.Telegram?.WebApp;

    if (!twa) {
      setState(s => ({ ...s, isLoading: false, error: 'Telegram WebApp недоступен' }));
      return;
    }

    // Сообщаем Telegram что приложение готово
    twa.ready();
    twa.expand();

    const initData = twa.initData;

    if (!initData) {
      // В dev-режиме initData может быть пустым (браузер, не Telegram)
      if (import.meta.env.DEV) {
        console.warn('[auth] initData пуст — dev-режим, авторизация пропущена');
        setState(s => ({ ...s, isLoading: false }));
        return;
      }
      setState(s => ({ ...s, isLoading: false, error: 'initData отсутствует' }));
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/telegram`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initData }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      _accessToken  = data.accessToken;
      _refreshToken = data.refreshToken;

      setState({
        user:        data.user,
        isLoading:   false,
        error:       null,
        accessToken: data.accessToken,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, []);

  // Обновление access-токена (вызывается автоматически при 401)
  const refreshTokens = useCallback(async (): Promise<string | null> => {
    if (!_refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: _refreshToken }),
      });

      if (!res.ok) throw new Error('Refresh failed');

      const { accessToken } = await res.json();
      _accessToken = accessToken;
      setState(s => ({ ...s, accessToken }));
      return accessToken;
    } catch {
      // Refresh не удался — разлогиниваем
      _accessToken  = null;
      _refreshToken = null;
      setState({ user: null, isLoading: false, error: 'Сессия истекла', accessToken: null });
      return null;
    }
  }, []);

  useEffect(() => {
    login();
  }, [login]);

  return { ...state, refreshTokens };
}

// ── Axios / fetch interceptor helper ─────────────────────────────────────────
/**
 * Обёртка над fetch с автоматическим добавлением Authorization
 * и повторной попыткой при 401 (через refreshTokens).
 *
 * Использование:
 *   const res = await apiFetch('/api/v1/catalog');
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  onRefreshFail?: () => void,
): Promise<Response> {
  const makeRequest = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await makeRequest(_accessToken);

  if (res.status === 401 && _refreshToken) {
    // Пробуем обновить токен
    try {
      const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: _refreshToken }),
      });

      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json();
        _accessToken = accessToken;
        res = await makeRequest(accessToken);
      } else {
        _accessToken = _refreshToken = null;
        onRefreshFail?.();
      }
    } catch {
      onRefreshFail?.();
    }
  }

  return res;
}
