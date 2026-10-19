
import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";

import { generateOpenApiSpec } from "./openapi-generator.js";
import { ALL_ENDPOINTS } from "./endpoints/index.js";
import { MODULES } from "./modules-data.js";

const router = Router();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../../");

const openApiSpec = generateOpenApiSpec();

router.get("/api/v1/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

router.get("/api/v1/openapi.yaml", (_req, res, next) => {
  res.sendFile(path.join(projectRoot, "openapi.yaml"), (error) => {
    if (error) next(error);
  });
});

router.get("/api/v1/inventory", (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    totalEndpoints: ALL_ENDPOINTS.length,
    totalModules: MODULES.length,
    modules: MODULES,
    endpoints: ALL_ENDPOINTS,
  });
});

router.get("/docs/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "DermaCare AI Documentation",
    timestamp: new Date().toISOString(),
  });
});

router.use(
  "/docs/swagger",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec),
);

export default router;
