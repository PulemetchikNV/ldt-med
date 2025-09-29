import { FastifyReply, FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: number;
      email: string;
    };
    user: {
      userId: number;
      email: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}
