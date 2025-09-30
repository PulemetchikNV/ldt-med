import axios from "axios";
import { useAuthStore } from '../stores/auth'

console.log('AXIOS INIT', import.meta.env.VITE_API_URL);


export const axiosInstance = axios.create({
    baseURL: (import.meta as any).env?.VITE_API_URL || (window as any).__VITE_API_URL__ || '/'
})

axiosInstance.interceptors.request.use((config) => {
    const token = useAuthStore().token
    if (token) (config.headers as any).Authorization = `Bearer ${token}`
    return config
})

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        console.log({ error });

        if (error.response?.status === 401) {
            useAuthStore().logout()
        }
        return Promise.reject(error);
    }
)

