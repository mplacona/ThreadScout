import { promises as fs } from 'fs';
import { join } from 'path';

async function buildFunctions() {
  console.log('Building functions...');
  
  try {
    const functionsDir = 'functions/tools';
    const sharedDir = 'functions/shared';
    
    // Ensure directories exist
    await fs.mkdir(functionsDir, { recursive: true });
    await fs.mkdir(sharedDir, { recursive: true });
    
    // Get list of function directories
    const functionDirs = await fs.readdir(functionsDir);
    
    for (const functionDir of functionDirs) {
      const functionPath = join(functionsDir, functionDir);
      const stat = await fs.stat(functionPath);
      
      if (stat.isDirectory()) {
        console.log(`Building function: ${functionDir}`);
        await copySharedDependencies(functionPath);
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

async function copySharedDependencies(functionPath: string) {
  const sharedDir = 'functions/shared';
  const targetSharedDir = join(functionPath, 'shared');
  
  try {
    // Create shared directory in function
    await fs.mkdir(targetSharedDir, { recursive: true });
    
    // Copy shared files
    const sharedFiles = await fs.readdir(sharedDir);
    
    for (const file of sharedFiles) {
      const sourcePath = join(sharedDir, file);
      const targetPath = join(targetSharedDir, file);
      
      const content = await fs.readFile(sourcePath, 'utf-8');
      await fs.writeFile(targetPath, content);
    }
    
    console.log(`  ✓ Copied shared dependencies to ${functionPath}`);
  } catch (error) {
    console.warn(`  ⚠ Warning: Could not copy shared dependencies to ${functionPath}:`, error);
  }
}

buildFunctions();