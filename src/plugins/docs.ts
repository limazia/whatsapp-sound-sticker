import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import fp from "fastify-plugin";

import {
  createSwaggerConfig,
  docsPath,
  docsTitle,
} from "@/config/swagger.config";

export default fp(
  async (app, { scalarApiKey }: { scalarApiKey?: string }) => {
    await app.register(swagger, await createSwaggerConfig());
    const schema = { hide: true };
    app.get(`${docsPath}/openapi.json`, { schema }, async () => app.swagger());
    app.get(`${docsPath}/openapi.yaml`, { schema }, async (_request, reply) => {
      return reply.type("application/yaml").send(app.swagger({ yaml: true }));
    });

    await app.register(scalar, {
      routePrefix: docsPath,
      configuration: {
        pageTitle: docsTitle,
        url: "./openapi.json",
        authentication: {
          preferredSecurityScheme: "apiKey",
          ...(scalarApiKey ? { securitySchemes: { apiKey: { value: scalarApiKey } } } : {}),
        },
      },
    });
  },
  { name: "api-docs" },
);
