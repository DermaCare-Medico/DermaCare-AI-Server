import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiSpec } from './docs/openapi-generator.js';
import { ALL_ENDPOINTS } from './docs/endpoints/index.js';
import { MODULES } from './docs/modules-data.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache generated OpenAPI document
const openApiSpec = generateOpenApiSpec();

// Public Static Assets
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(currentDir, 'public');
app.use(express.static(publicDir));

// 1. Authoritative OpenAPI Spec Endpoints
app.get('/api/v1/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

app.get('/api/v1/openapi.yaml', (req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'openapi.yaml'));
});

// 2. Machine-Readable Endpoint Inventory
app.get('/api/v1/inventory', (req: Request, res: Response) => {
  res.json({
    generatedAt: new Date().toISOString(),
    totalEndpoints: ALL_ENDPOINTS.length,
    totalModules: MODULES.length,
    contractStatus: '84 Proposed Endpoints Specified (0 Implemented in Repository)',
    modules: MODULES,
    endpoints: ALL_ENDPOINTS
  });
});

// 3. Operational Health Check Endpoint (Module 13 #68)
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'DermaCare AI API Reference Server',
    version: '1.0.0-proposed',
    timestamp: new Date().toISOString(),
    contractAudit: {
      totalProposedEndpoints: 84,
      totalModules: 16,
      implementationStatus: 'Specified but not implemented in codebase'
    }
  });
});

// 4. Classic Swagger UI Renderer (/docs/swagger & /api-docs)
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #11131a; border-bottom: 1px solid #1e2230; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui { background-color: #090a0f; color: #f1f5f9; }
    .swagger-ui .info .title { color: #f1f5f9; }
    .swagger-ui .scheme-container { background-color: #11131a; box-shadow: none; border-bottom: 1px solid #1e2230; }
  `,
  customSiteTitle: 'DermaCare AI — Swagger API Reference',
  customfavIcon: '/favicon.ico'
};

app.use('/docs/swagger', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));

// 5. Safe Interactive Try-It-Out Contract Simulator for /api/v1
app.use('/api/v1', (req: Request, res: Response) => {
  const method = req.method.toUpperCase();
  const subPath = req.path; // Already stripped of /api/v1

  // Look for matching endpoint in proposed contract
  const matchedEp = ALL_ENDPOINTS.find(ep => {
    if (ep.method !== method) return false;
    // Normalize path parameter e.g. /screenings/{id} vs /screenings/demo_item_123
    const regex = new RegExp('^' + ep.path.replace(/\{[^}]+\}/g, '[^/]+') + '$');
    return regex.test(subPath);
  });

  // Always set contract audit headers
  res.setHeader('X-Contract-Status', 'Specified-Not-Implemented');
  res.setHeader('X-Healthcare-Safety-Enforced', 'true');
  res.setHeader('X-DermaCare-MVP-Audit', 'Proposed-Contract-Simulation');

  if (matchedEp) {
    const defaultResponse = matchedEp.responses.find(r => r.statusCode < 300) || matchedEp.responses[0]!;
    const isSuccess = defaultResponse.statusCode < 300;

    return res.status(defaultResponse.statusCode).json({
      _contractNotice: {
        status: matchedEp.implementationStatus,
        endpointId: matchedEp.id,
        module: `Module ${matchedEp.moduleNumber} — ${matchedEp.moduleName}`,
        message: 'This response is simulated directly from the authoritative OpenAPI contract example. Backend route is not yet implemented in repository.'
      },
      ...(defaultResponse.example || {
        success: isSuccess,
        message: 'Contract simulated response'
      })
    });
  }

  // Not in contract
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested path /api/v1${req.path} is not in the DermaCare AI 84-endpoint contract specification.`
    }
  });
});

// 6. Root Route & Portal Fallback
app.get(['/', '/docs'], (req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON_PAYLOAD',
        message: 'Malformed JSON payload provided.'
      }
    });
  }
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.'
    }
  });
});

// Start Server
const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 DermaCare AI Premium Documentation Portal is LIVE!`);
    console.log(`   • Portal URL:         http://localhost:${PORT}/`);
    console.log(`   • Swagger UI:         http://localhost:${PORT}/docs/swagger`);
    console.log(`   • OpenAPI JSON:       http://localhost:${PORT}/api/v1/openapi.json`);
    console.log(`   • OpenAPI YAML:       http://localhost:${PORT}/api/v1/openapi.yaml`);
    console.log(`   • Endpoint Inventory: http://localhost:${PORT}/api/v1/inventory`);
    console.log(`   • Health Check:       http://localhost:${PORT}/api/v1/health`);
    console.log(`============================================================\n`);
  });
}

export default app;

