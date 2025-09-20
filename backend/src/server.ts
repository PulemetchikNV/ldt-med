import Fastify, { FastifyInstance } from 'fastify';
import healthcheckRoutes from './routes/healthcheck.js';

// Создаем экземпляр Fastify
const fastify: FastifyInstance = Fastify({
    logger: true
});

// Регистрируем роуты
fastify.register(healthcheckRoutes, { prefix: '/api' });

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
