import { migrate, ensureBoard, resetForRebuild } from './db.js';
import { runIndexer } from './indexer.js';

const isRebuild = process.argv.includes('--rebuild');

async function main(): Promise<void> {
  console.log('[board-indexer] Starting...');

  await migrate();
  console.log('[board-indexer] Schema ready');

  if (isRebuild) {
    console.log('[board-indexer] --rebuild: clearing all indexed data');
    await resetForRebuild();
  }

  await ensureBoard();
  console.log('[board-indexer] Board record ready');

  await runIndexer();
}

main().catch(err => {
  console.error('[board-indexer] Fatal:', err);
  process.exit(1);
});
