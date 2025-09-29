import { defineStore } from 'pinia';
import { ref } from 'vue';

const API_BASE = 'http://localhost:3000/api';

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token'));
    const user = ref<{ id: number; email: string } | null>(null);
    const isAuthenticated = ref(!!token.value);

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const data = await response.json();
        token.value = data.token;
        user.value = { id: data.userId, email: data.email };
        isAuthenticated.value = true;
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', String(data.userId));
    };

    const register = async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const data = await response.json();
        token.value = data.token;
        user.value = { id: data.userId, email: data.email };
        isAuthenticated.value = true;
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', String(data.userId));
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
            const response = await fetch(`${API_BASE}/auth/verify`, {
                headers: { Authorization: `Bearer ${token.value}` },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                user.value = { id: data.userId, email: data.email };
                isAuthenticated.value = true;
                localStorage.setItem('userId', String(data.userId));
            } else {
                logout();
            }
        } catch {
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

