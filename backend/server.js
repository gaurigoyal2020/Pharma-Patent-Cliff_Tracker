// server.js  (replaces existing server.js)
import 'dotenv/config';
import app from './src/app.js';
import { createUsersTable }    from './src/models/user.js';
import { createWatchlistTable } from './src/models/watchlist.js';
import { createAlertsTable }    from './src/models/alert.js';
import { startAlertCron }       from './src/jobs/alertCron.js';

const PORT = process.env.PORT || 5000;

// ── Bootstrap DB tables (idempotent CREATE IF NOT EXISTS) ─────────────────────
await createUsersTable();
await createWatchlistTable();
await createAlertsTable();

// ── Start daily alert cron ────────────────────────────────────────────────────
startAlertCron();

// ── Start HTTP server ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Patent Cliff API running on http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   Drugs:     http://localhost:${PORT}/api/drugs`);
  console.log(`   Auth:      http://localhost:${PORT}/api/auth`);
  console.log(`   Users:     http://localhost:${PORT}/api/users/watchlist`);
  console.log(`              http://localhost:${PORT}/api/users/alerts\n`);
});