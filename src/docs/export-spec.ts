import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { generateOpenApiSpec } from './openapi-generator';
import { ALL_ENDPOINTS } from './endpoints';
import { MODULES } from './modules-data';

export function exportSpecification() {
  const spec = generateOpenApiSpec();
  const specJson = JSON.stringify(spec, null, 2);
  const specYaml = yaml.stringify(spec);

  const rootDir = path.resolve(__dirname, '../../');
  const srcPublicDir = path.resolve(__dirname, '../public');
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
    totalEndpoints: ALL_ENDPOINTS.length,
    totalModules: MODULES.length,
    countsByStatus: {
      implementedAndVerified: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Implemented and verified').length,
      partiallyImplemented: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Partially implemented').length,
      specifiedButNotImplemented: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Specified but not implemented').length,
      requiresVerification: ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Requires verification').length
    },
    modules: MODULES,
    endpoints: ALL_ENDPOINTS
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
  console.log(`   - ${path.join(srcPublicDir, 'inventory.json')} (${ALL_ENDPOINTS.length} endpoints)`);

  return spec;
}

if (require.main === module) {
  exportSpecification();
}

