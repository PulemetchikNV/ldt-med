import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import healthcheckRoutes from './routes/healthcheck.js';
import authRoutes from './routes/auth.js';
import mlRoutes from './routes/ml.js';

// Создаем экземпляр Fastify
const fastify: FastifyInstance = Fastify({
    logger: true
});

// Регистрируем плагины
fastify.register(cors, {
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
fastify.register(jwt, { secret: 'supersecret' });
fastify.register(multipart, {
    limits: {
        fileSize: 1000 * 1024 * 1024, // 1GB для медицинских файлов
    }
});

// Добавляем декоратор для аутентификации
fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
});

// Регистрируем роуты
fastify.register(healthcheckRoutes, { prefix: '/api' });
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(mlRoutes, { prefix: '/api/ml' });

// Запускаем сервер
const start = async (): Promise<void> => {
    try {
        await fastify.listen({
            port: 3000,
            host: '0.0.0.0'
        });
        console.log('🚀 Сервер запущен на http://localhost:3000');
        console.log('📋 Healthcheck доступен по адресу: http://localhost:3000/api/health');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
