import type { FastifyCorsOptions } from "@fastify/cors";

import type { NodeEnvironment } from "@/config/env.config";

const allowedOrigins: Record<NodeEnvironment, string[]> = {
  development: ["*"],
  test: ["*"],
  qa: ["*"],
  production: ["*"],
};

export function createCorsConfig(nodeEnv: NodeEnvironment): FastifyCorsOptions {
  return {
    origin: allowedOrigins[nodeEnv],
    methods: ["GET", "HEAD", "POST", "DELETE"],
  };
}
