/**
 * Роуты для проверки состояния сервера
 */

export default async function healthcheckRoutes(fastify, options) {
    // GET /health - проверка состояния сервера
    fastify.get('/health', async (request, reply) => {
        const healthcheck = {
            uptime: process.uptime(),
            message: 'Сервер работает нормально',
            timestamp: new Date().toISOString(),
            status: 'OK',
            version: '1.0.0'
        };

        return reply.code(200).send(healthcheck);
    });

    // GET /health/detailed - детальная проверка состояния
    fastify.get('/health/detailed', async (request, reply) => {
        const memoryUsage = process.memoryUsage();

        const healthcheck = {
            uptime: process.uptime(),
            message: 'Детальная информация о состоянии сервера',
            timestamp: new Date().toISOString(),
            status: 'OK',
            version: '1.0.0',
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                memory: {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
                }
            }
        };

        return reply.code(200).send(healthcheck);
    });
}
