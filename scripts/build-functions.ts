import { promises as fs } from 'fs';
import { join } from 'path';

async function buildFunctions() {
  console.log('Building functions...');
  
  try {
    const functionsDir = 'functions/tools';
    
    // Ensure directory exists
    await fs.mkdir(functionsDir, { recursive: true });
    
    // Get list of function directories
    const functionDirs = await fs.readdir(functionsDir);
    
    for (const functionDir of functionDirs) {
      const functionPath = join(functionsDir, functionDir);
      const stat = await fs.stat(functionPath);
      
      if (stat.isDirectory()) {
        console.log(`✓ Function ready: ${functionDir}`);
      }
    }
    
    console.log('✓ Functions build complete');
    console.log('\nNext steps:');
    console.log('1. Deploy with: doctl serverless deploy .');
    console.log('2. Update your main app to call the function URLs');
    console.log('3. Test the function with: curl -X POST <function-url> -d \'{"text":"test", "allowlist":[]}\'');
    
  } catch (error) {
    console.error('❌ Functions build failed:', error);
    process.exit(1);
  }
}

// Shared dependencies are embedded in each function for DigitalOcean Functions
// No copying needed since functions are self-contained

buildFunctions();