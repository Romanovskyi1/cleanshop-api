"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.useTelegramAuth = useTelegramAuth;
exports.apiFetch = apiFetch;
const react_1 = require("react");
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.cleanshop.eu';
let _accessToken = null;
let _refreshToken = null;
function getAccessToken() {
    return _accessToken;
}
function useTelegramAuth() {
    const [state, setState] = (0, react_1.useState)({
        user: null,
        isLoading: true,
        error: null,
        accessToken: null,
    });
    const login = (0, react_1.useCallback)(async () => {
        const twa = window.Telegram?.WebApp;
        if (!twa) {
            setState(s => ({ ...s, isLoading: false, error: 'Telegram WebApp недоступен' }));
            return;
        }
        twa.ready();
        twa.expand();
        const initData = twa.initData;
        if (!initData) {
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            _accessToken = data.accessToken;
            _refreshToken = data.refreshToken;
            setState({
                user: data.user,
                isLoading: false,
                error: null,
                accessToken: data.accessToken,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
            setState(s => ({ ...s, isLoading: false, error: msg }));
        }
    }, []);
    const refreshTokens = (0, react_1.useCallback)(async () => {
        if (!_refreshToken)
            return null;
        try {
            const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: _refreshToken }),
            });
            if (!res.ok)
                throw new Error('Refresh failed');
            const { accessToken } = await res.json();
            _accessToken = accessToken;
            setState(s => ({ ...s, accessToken }));
            return accessToken;
        }
        catch {
            _accessToken = null;
            _refreshToken = null;
            setState({ user: null, isLoading: false, error: 'Сессия истекла', accessToken: null });
            return null;
        }
    }, []);
    (0, react_1.useEffect)(() => {
        login();
    }, [login]);
    return { ...state, refreshTokens };
}
async function apiFetch(path, options = {}, onRefreshFail) {
    const makeRequest = (token) => fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers ?? {}),
        },
    });
    let res = await makeRequest(_accessToken);
    if (res.status === 401 && _refreshToken) {
        try {
            const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: _refreshToken }),
            });
            if (refreshRes.ok) {
                const { accessToken } = await refreshRes.json();
                _accessToken = accessToken;
                res = await makeRequest(accessToken);
            }
            else {
                _accessToken = _refreshToken = null;
                onRefreshFail?.();
            }
        }
        catch {
            onRefreshFail?.();
        }
    }
    return res;
}
//# sourceMappingURL=useTelegramAuth.js.map