import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface UserData {
    email: string;
    password: string;
}

// Простое in-memory хранилище пользователей
const users: Map<string, { email: string; password: string }> = new Map();

export default async function authRoutes(fastify: FastifyInstance) {
    // Регистрация
    fastify.post('/register', async (request: FastifyRequest<{ Body: UserData }>, reply: FastifyReply) => {
        const { email, password } = request.body;

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email и пароль обязательны' });
        }

        if (users.has(email)) {
            return reply.status(400).send({ error: 'Пользователь уже существует' });
        }

        users.set(email, { email, password });
        const token = fastify.jwt.sign({ email });

        return reply.send({ token, email });
    });

    // Вход
    fastify.post('/login', async (request: FastifyRequest<{ Body: UserData }>, reply: FastifyReply) => {
        const { email, password } = request.body;

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email и пароль обязательны' });
        }

        const user = users.get(email);
        if (!user || user.password !== password) {
            return reply.status(401).send({ error: 'Неверные данные' });
        }

        const token = fastify.jwt.sign({ email });
        return reply.send({ token, email });
    });

    // Проверка токена
    fastify.get('/verify', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({ email: (request.user as any).email });
    });
}

