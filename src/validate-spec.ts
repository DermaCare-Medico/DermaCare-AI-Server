import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import { pathToFileURL } from 'url';
import { exportSpecification } from './docs/export-spec.js';
import { ALL_ENDPOINTS } from './docs/endpoints/index.js';
import { MODULES } from './docs/modules-data.js';

async function validateOpenApiSpecification() {
  console.log('====================================================');
  console.log('🔍 DERMACARE AI — OPENAPI SPECIFICATION VALIDATOR');
  console.log('====================================================\n');

  // 1. Export the latest spec
  console.log('📦 Step 1: Exporting authoritative OpenAPI 3.0.3 document...');
  const spec = exportSpecification();

  // 2. Validate using SwaggerParser
  console.log('\n🛡️ Step 2: Validating schema with @apidevtools/swagger-parser...');
  try {
    const validatedApi = await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
    console.log(`✅ OpenAPI 3.0.3 Schema is 100% VALID! Title: "${validatedApi.info.title}"`);
  } catch (err: any) {
    console.error('❌ OpenAPI validation failed:', err.message);
    process.exit(1);
  }

  // 3. Verify Endpoint Inventory completeness
  console.log('\n📊 Step 3: Verifying completeness of 84 proposed REST endpoints...');
  const operations: { id: number; method: string; path: string; tag: string }[] = [];

  for (const [pathKey, pathObj] of Object.entries(spec.paths as Record<string, any>)) {
    for (const [methodKey, opObj] of Object.entries(pathObj as Record<string, any>)) {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(methodKey.toLowerCase())) {
        operations.push({
          id: opObj['x-endpoint-id'],
          method: methodKey.toUpperCase(),
          path: pathKey,
          tag: opObj.tags?.[0] || 'Unknown'
        });
      }
    }
  }

  console.log(`- Expected endpoints: 84`);
  console.log(`- Documented operations in OpenAPI: ${operations.length}`);
  console.log(`- Expected modules: 16`);
  console.log(`- Documented tags in OpenAPI: ${spec.tags.length}`);

  if (operations.length !== 84) {
    console.error(`❌ Mismatch! Found ${operations.length} operations, expected 84.`);
    process.exit(1);
  }

  if (MODULES.length !== 16) {
    console.error(`❌ Mismatch! Found ${MODULES.length} modules, expected 16.`);
    process.exit(1);
  }

  // Check unique IDs 1..84
  const ids = operations.map(o => o.id).sort((a, b) => a - b);
  const missingIds: number[] = [];
  for (let i = 1; i <= 84; i++) {
    if (!ids.includes(i)) {
      missingIds.push(i);
    }
  }

  if (missingIds.length > 0) {
    console.error(`❌ Missing endpoint IDs in spec: ${missingIds.join(', ')}`);
    process.exit(1);
  }

  console.log('\n📋 Step 4: Endpoint Status Breakdown:');
  const statusCounts = {
    'Implemented and verified': ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Implemented and verified').length,
    'Partially implemented': ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Partially implemented').length,
    'Specified but not implemented': ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Specified but not implemented').length,
    'Requires verification': ALL_ENDPOINTS.filter(e => e.implementationStatus === 'Requires verification').length
  };

  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`   • ${status.padEnd(32)}: ${count}`);
  }

  console.log('\n====================================================');
  console.log('🎉 AUDIT COMPLETE: All 84 endpoints validated successfully!');
  console.log('====================================================\n');
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isMainModule) {
  validateOpenApiSpecification().catch(err => {
    console.error('Fatal error during validation:', err);
    process.exit(1);
  });
}

export { validateOpenApiSpecification };

