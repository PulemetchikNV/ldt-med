import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

interface AuthBody {
    email: string;
    password: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/register', async (request: FastifyRequest<{ Body: AuthBody }>, reply: FastifyReply) => {
        const rawEmail = request.body?.email ?? '';
        const password = request.body?.password ?? '';
        const email = normalizeEmail(rawEmail);

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email и пароль обязательны' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return reply.status(400).send({ error: 'Пользователь уже существует' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash
            }
        });

        const token = fastify.jwt.sign({ userId: user.id, email: user.email });

        return reply.send({
            token,
            email: user.email,
            userId: user.id
        });
    });

    fastify.post('/login', async (request: FastifyRequest<{ Body: AuthBody }>, reply: FastifyReply) => {
        const rawEmail = request.body?.email ?? '';
        const password = request.body?.password ?? '';
        const email = normalizeEmail(rawEmail);

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email и пароль обязательны' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.status(401).send({ error: 'Неверные данные' });
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return reply.status(401).send({ error: 'Неверные данные' });
        }

        const token = fastify.jwt.sign({ userId: user.id, email: user.email });
        return reply.send({ token, email: user.email, userId: user.id });
    });

    fastify.get('/verify', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const userPayload = request.user as { userId: number; email: string };
        return reply.send({ email: userPayload.email, userId: userPayload.userId });
    });
}

