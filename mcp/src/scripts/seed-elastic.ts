import { ElasticService } from '../services/elastic.client.js';
import { SEED_KNOWLEDGE_CARDS } from '../services/seed.data.js';

async function seed() {
  console.log('[SeedScript] Initializing Elasticsearch Seeding...');
  const service = new ElasticService();

  if (!service.isConnected()) {
    console.warn('[SeedScript] No ELASTICSEARCH_URL set. Seed script completed (dry-run).');
    process.exit(0);
  }

  try {
    await service.initIndex();
    console.log(`[SeedScript] Index initialized. Seeding ${SEED_KNOWLEDGE_CARDS.length} cards...`);

    for (const card of SEED_KNOWLEDGE_CARDS) {
      await service.indexFix(card);
      console.log(`[SeedScript] Indexed card: ${card.id}`);
    }

    console.log('[SeedScript] Seeding complete!');
  } catch (error) {
    console.error('[SeedScript] Seeding failed:', error);
    process.exit(1);
  }
}

seed();
