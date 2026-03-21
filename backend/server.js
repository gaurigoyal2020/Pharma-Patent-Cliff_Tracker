import 'dotenv/config';
import app from './src/app.js';
import { createUsersTable } from './src/models/user.js';

const PORT = process.env.PORT || 5000;

// Create tables if they don't exist, then start server
await createUsersTable();

app.listen(PORT, () => {
  console.log(`\n🚀 Patent Cliff API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Drugs:  http://localhost:${PORT}/api/drugs`);
  console.log(`   Auth:   http://localhost:${PORT}/api/auth\n`);
});