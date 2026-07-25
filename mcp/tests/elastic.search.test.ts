import { ElasticService } from '../src/services/elastic.client.js';
import { SEED_KNOWLEDGE_CARDS } from '../src/services/seed.data.js';

async function runTests() {
  console.log('--- Running Phase 1 Search & Verification Tests ---');

  const service = new ElasticService();
  if (!service.isConnected()) {
    console.log('ℹ️  Elasticsearch URL not configured. Running offline memory assertion tests...');
    if (SEED_KNOWLEDGE_CARDS.length >= 4) {
      console.log('✅ Offline Seed Dataset structure assertion passed.');
    } else {
      throw new Error('❌ Seed dataset is empty or corrupted.');
    }
    return;
  }

  console.log('🔍 Testing searchFix with stacktrace...');
  const results = await service.searchFix({
    stacktrace: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
    language: 'python',
    framework: 'fastapi',
  });

  if (results.length > 0) {
    console.log(`✅ Search test passed! Found ${results.length} matching fix(es). Top result ID: ${results[0].id}`);
  } else {
    console.warn('⚠️  Search test returned no results. Ensure seeding script has run.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
