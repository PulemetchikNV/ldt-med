import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Интерфейс для ответа healthcheck
 */
interface HealthcheckResponse {
  uptime: number;
  message: string;
  timestamp: string;
  status: string;
  version: string;
}

/**
 * Интерфейс для детального ответа healthcheck
 */
interface DetailedHealthcheckResponse extends HealthcheckResponse {
  system: {
    platform: string;
    nodeVersion: string;
    memory: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
      external: string;
    };
  };
}

/**
 * Роуты для проверки состояния сервера
 */
export default async function healthcheckRoutes(
  fastify: FastifyInstance, 
  options: any
): Promise<void> {
  // GET /health - проверка состояния сервера
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const healthcheck: HealthcheckResponse = {
      uptime: process.uptime(),
      message: 'Сервер работает нормально',
      timestamp: new Date().toISOString(),
      status: 'OK',
      version: '1.0.0'
    };

    return reply.code(200).send(healthcheck);
  });

  // GET /health/detailed - детальная проверка состояния
  fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const memoryUsage = process.memoryUsage();
    
    const healthcheck: DetailedHealthcheckResponse = {
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
