import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import basicAuth from "@fastify/basic-auth";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { docsPath } from "@/config/swagger.config";

const sessionCookie = "soundsticker_session";
const sessionSeconds = 8 * 60 * 60;
const digest = (value: string) => createHash("sha256").update(value).digest();

type Role = "admin" | "friend";
type Session = {
  id: string;
  role: Role;
  onRevoke: (callback: () => void) => () => void;
};

export interface AccessOptions {
  apiKey?: string;
  adminPassword?: string;
  friendCode?: string;
  docsUser?: string;
  docsPassword?: string;
  development?: boolean;
  secure?: boolean;
}

interface AccessService {
  login(code: string, request: FastifyRequest, reply: FastifyReply): Session | null;
  logout(request: FastifyRequest, reply: FastifyReply): void;
}

declare module "fastify" {
  interface FastifyRequest {
    access: Session | null;
  }

  interface FastifyInstance {
    access: AccessService;
  }

  interface FastifyContextConfig {
    access?: "public" | "friend";
  }
}

const accessPlugin: FastifyPluginAsync<AccessOptions> = async (app, options) => {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const apiKey = options.apiKey && digest(options.apiKey);
  const admin = options.adminPassword && digest(options.adminPassword);
  const friend = options.friendCode && digest(options.friendCode);
  const docsUser = options.docsUser && digest(options.docsUser);
  const docsPassword = options.docsPassword && digest(options.docsPassword);
  const sessions = new Map<string, { session: Session; revoke: () => void }>();
  const cookieOptions = {
    httpOnly: true,
    secure: options.secure ?? false,
    sameSite: "strict" as const,
    path: "/",
  };

  function createSession(role: Role): Session {
    const id = randomBytes(32).toString("base64url");
    const callbacks = new Set<() => void>();
    const revoke = () => {
      clearTimeout(timeout);
      sessions.delete(id);
      for (const callback of callbacks) callback();
      callbacks.clear();
    };
    const timeout = setTimeout(revoke, sessionSeconds * 1000);
    timeout.unref();
    const session: Session = {
      id, role,
      onRevoke(callback) {
        callbacks.add(callback);
        return () => { callbacks.delete(callback); };
      },
    };
    sessions.set(id, { session, revoke });
    return session;
  }

  function issueSession(role: Role, request: FastifyRequest, reply: FastifyReply) {
    sessions.get(request.cookies[sessionCookie] ?? "")?.revoke();
    const session = createSession(role);
    reply.setCookie(sessionCookie, session.id, { ...cookieOptions, maxAge: sessionSeconds });
    return session;
  }

  await app.register(basicAuth, {
    authenticate: { realm: "SoundSticker Admin" },
    async validate(username, password, request, reply) {
      if (!admin || username !== "admin" || !timingSafeEqual(digest(password), admin)) {
        throw new Error("Usuário ou senha de administrador inválidos.");
      }
      const current = sessions.get(request.cookies[sessionCookie] ?? "")?.session;
      if (current?.role !== "admin") issueSession("admin", request, reply);
    },
  });

  app.decorateRequest("access", null);
  app.decorate("access", {
    login(code, request, reply) {
      if (!friend || !timingSafeEqual(digest(code), friend)) return null;
      return issueSession("friend", request, reply);
    },
    logout(request, reply) {
      sessions.get(request.cookies[sessionCookie] ?? "")?.revoke();
      reply.clearCookie(sessionCookie, cookieOptions);
    },
  } satisfies AccessService);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?", 1)[0] ?? "";
    const isApi = path === "/api" || path.startsWith("/api/");
    const isAdminPage = path === "/admin" || path === "/admin/auth";
    if ((!isApi && !isAdminPage) || request.method === "OPTIONS" || path === "/api/health") return;

    reply.header("Cache-Control", "no-store");
    if (isApi) {
      const isDocs = path === docsPath || path.startsWith(`${docsPath}/`);
      if (isDocs) {
        if (options.development) return;
        const credentials = /^Basic ([\w+/]+={0,2})$/i.exec(request.headers.authorization ?? "");
        const decoded = credentials?.[1] && Buffer.from(credentials[1], "base64").toString("utf8");
        const separator = decoded ? decoded.indexOf(":") : -1;
        if (docsUser && docsPassword && decoded && separator > 0 &&
            timingSafeEqual(digest(decoded.slice(0, separator)), docsUser) &&
            timingSafeEqual(digest(decoded.slice(separator + 1)), docsPassword)) return;
        reply.header("WWW-Authenticate", 'Basic realm="SoundSticker Docs", charset="UTF-8"');
        return reply.code(401).send({ ok: false, error: "Credenciais da documentação inválidas." });
      }
      const key = request.headers["x-api-key"];
      if (!apiKey || typeof key !== "string" || !timingSafeEqual(digest(key), apiKey)) {
        return reply.code(401).send({ ok: false, error: "API_KEY ausente ou inválida." });
      }
      if (request.is404) return;
    }

    const origin = request.headers.origin;
    if (origin && URL.parse(origin)?.host !== request.host) {
      return reply.code(403).send({ ok: false, error: "Origem não autorizada." });
    }

    request.access = sessions.get(request.cookies[sessionCookie] ?? "")?.session ?? null;
    const access = request.routeOptions.config?.access;
    if (access === "public") return;
    if (!request.access) {
      return reply.code(401).send({ ok: false, error: "Entre com seu código de acesso." });
    }
    if (access !== "friend" && request.access.role !== "admin") {
      return reply.code(403).send({ ok: false, error: "Acesso de administrador necessário." });
    }
  });

  app.addHook("onClose", async () => {
    for (const { revoke } of sessions.values()) revoke();
  });
};

export default fp(accessPlugin, { name: "access" });
