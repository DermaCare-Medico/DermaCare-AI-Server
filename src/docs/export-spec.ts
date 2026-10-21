import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as yaml from 'yaml';
import { generateOpenApiSpec } from './openapi-generator.js';
import { ALL_ENDPOINTS } from './endpoints/index.js';
import { MODULES } from './modules-data.js';
import { ACTIVE_ENDPOINTS } from './active-endpoints.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function exportSpecification() {
  const spec = generateOpenApiSpec();
  const specJson = JSON.stringify(spec, null, 2);
  const specYaml = yaml.stringify(spec);

  const rootDir = path.resolve(currentDir, '../../');
  const srcPublicDir = path.resolve(currentDir, '../public');
  const distPublicDir = path.resolve(rootDir, 'dist/public');

  if (!fs.existsSync(srcPublicDir)) {
    fs.mkdirSync(srcPublicDir, { recursive: true });
  }

  // Write root openapi files
  fs.writeFileSync(path.join(rootDir, 'openapi.json'), specJson, 'utf-8');
  fs.writeFileSync(path.join(rootDir, 'openapi.yaml'), specYaml, 'utf-8');

  // Write public openapi files for direct web download
  fs.writeFileSync(path.join(srcPublicDir, 'openapi.json'), specJson, 'utf-8');
  fs.writeFileSync(path.join(srcPublicDir, 'openapi.yaml'), specYaml, 'utf-8');

  // Write inventory JSON for client-side rendering
  const inventoryData = {
    generatedAt: new Date().toISOString(),
    totalEndpoints: ACTIVE_ENDPOINTS.length,
    proposedEndpointCount: ALL_ENDPOINTS.length,
    totalModules: MODULES.length,
    countsByStatus: {
      implementedAndVerified: ACTIVE_ENDPOINTS.length,
      partiallyImplemented: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Partially implemented').length,
      specifiedButNotImplemented: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Specified but not implemented').length,
      requiresVerification: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Requires verification').length
    },
    modules: MODULES,
    endpoints: ACTIVE_ENDPOINTS,
    proposedEndpoints: ALL_ENDPOINTS
  };

  fs.writeFileSync(path.join(srcPublicDir, 'inventory.json'), JSON.stringify(inventoryData, null, 2), 'utf-8');

  // If dist exists, copy public directory to dist/public
  if (fs.existsSync(path.resolve(rootDir, 'dist'))) {
    if (!fs.existsSync(distPublicDir)) {
      fs.mkdirSync(distPublicDir, { recursive: true });
    }
    const publicFiles = fs.readdirSync(srcPublicDir);
    for (const file of publicFiles) {
      fs.copyFileSync(path.join(srcPublicDir, file), path.join(distPublicDir, file));
    }
  }

  console.log('✅ Exported authoritative OpenAPI specifications:');
  console.log(`   - ${path.join(rootDir, 'openapi.json')}`);
  console.log(`   - ${path.join(rootDir, 'openapi.yaml')}`);
  console.log(`   - ${path.join(srcPublicDir, 'openapi.json')}`);
  console.log(`   - ${path.join(srcPublicDir, 'openapi.yaml')}`);
  console.log(`   - ${path.join(srcPublicDir, 'inventory.json')} (${ACTIVE_ENDPOINTS.length} active endpoints)`);

  return spec;
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isMainModule) {
  exportSpecification();
}

