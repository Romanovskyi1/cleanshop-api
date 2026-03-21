declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                initData: string;
                initDataUnsafe: {
                    user?: {
                        id: number;
                        first_name: string;
                    };
                };
                ready: () => void;
                expand: () => void;
                close: () => void;
                colorScheme: 'light' | 'dark';
                themeParams: Record<string, string>;
            };
        };
    }
}
export interface AuthUser {
    id: number;
    telegramId: string;
    displayName: string;
    role: 'client' | 'manager' | 'admin';
    companyId: number | null;
    languageCode: string;
}
export declare function getAccessToken(): string | null;
export declare function useTelegramAuth(): any;
export declare function apiFetch(path: string, options?: RequestInit, onRefreshFail?: () => void): Promise<Response>;
