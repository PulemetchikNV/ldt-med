import { defineStore } from 'pinia';
import { ref } from 'vue';
import { axiosInstance } from '../plugins/axios';
import { isAxiosError, type AxiosError } from 'axios';

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token'));
    const user = ref<{ id: number; email: string } | null>(null);
    const isAuthenticated = ref(!!token.value);

    const login = async (email: string, password: string) => {
        try {
            const { data } = await axiosInstance.post('/api/auth/login', { email, password });
            token.value = data.token;
            user.value = { id: data.userId, email: data.email };
            isAuthenticated.value = true;
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', String(data.userId));
        } catch (error) {
            const message = extractErrorMessage(error);
            throw new Error(message);
        }
    };

    const register = async (email: string, password: string) => {
        try {
            const { data } = await axiosInstance.post('/api/auth/register', { email, password });
            token.value = data.token;
            user.value = { id: data.userId, email: data.email };
            isAuthenticated.value = true;
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', String(data.userId));
        } catch (error) {
            const message = extractErrorMessage(error);
            throw new Error(message);
        }
    };

    const logout = () => {
        token.value = null;
        user.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
    };

    const checkAuth = async () => {
        if (!token.value) return;

        try {
            const { data } = await axiosInstance.get('/api/auth/verify');
            user.value = { id: data.userId, email: data.email };
            isAuthenticated.value = true;
            localStorage.setItem('userId', String(data.userId));
        } catch (error) {
            logout();
        }
    };

    return {
        token,
        user,
        isAuthenticated,
        login,
        register,
        logout,
        checkAuth
    };
});

function extractErrorMessage(error: unknown): string {
    const fallback = 'Ошибка авторизации, попробуйте снова.';

    if (isAxiosError(error)) {
        const axiosError = error as AxiosError<{ error?: string; message?: string }>;
        return (
            axiosError.response?.data?.error ||
            axiosError.response?.data?.message ||
            axiosError.message ||
            fallback
        );
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
}
