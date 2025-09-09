import { promises as fs } from 'fs';
import { join } from 'path';

async function buildServer() {
  console.log('Building server...');
  
  try {
    // For now, we'll use tsx to run the server directly in production
    // In a real deployment, you might want to compile TypeScript to JavaScript
    
    // Create a simple server start script
    const serverScript = `#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting ThreadScout server...');

const serverPath = join(__dirname, '../server/index.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
`;

    await fs.writeFile(join(process.cwd(), 'dist/server.mjs'), serverScript);
    await fs.chmod(join(process.cwd(), 'dist/server.mjs'), '755');
    
    console.log('✓ Server build complete');
  } catch (error) {
    console.error('❌ Server build failed:', error);
    process.exit(1);
  }
}

buildServer();