import chalk from 'chalk';

interface StartupConfig {
  port: number;
  environment: string;
  hasRedditCreds: boolean;
  hasAgentCreds: boolean;
  hasSpacesCreds: boolean;
  hasAgentTools: boolean;
}

export function displayStartupBanner(config: StartupConfig) {
  const { port, environment, hasRedditCreds, hasAgentCreds, hasSpacesCreds, hasAgentTools } = config;
  
  console.log();
  console.log(chalk.cyan.bold('┌─────────────────────────────────────┐'));
  console.log(chalk.cyan.bold('│') + chalk.white.bold('              ThreadScout            ') + chalk.cyan.bold('│'));
  console.log(chalk.cyan.bold('│') + chalk.gray('       Reddit Thread Discovery       ') + chalk.cyan.bold('│'));
  console.log(chalk.cyan.bold('└─────────────────────────────────────┘'));
  console.log();
  
  // Main access URL - this is the most important info
  console.log(chalk.green.bold('🌐 Access your app: ') + chalk.white.bold.underline(`http://localhost:${port}`));
  console.log();
  
  // Environment info
  console.log(chalk.blue('Environment: ') + chalk.white.bold(environment));
  console.log();
  
  // Configuration status with better formatting
  console.log(chalk.blue('Configuration:'));
  console.log(`  ${getStatusIcon(hasRedditCreds)} Reddit API: ${getStatusText(hasRedditCreds, 'Connected', 'Using fallback')}`);
  console.log(`  ${getStatusIcon(hasAgentCreds)} Agent API: ${getStatusText(hasAgentCreds, 'Connected', 'Missing')}`);
  console.log(`  ${getStatusIcon(hasSpacesCreds)} Storage: ${getStatusText(hasSpacesCreds, 'Cloud (Spaces)', 'Local storage')}`);
  console.log(`  ${getStatusIcon(hasAgentTools)} Agent Tools: ${getStatusText(hasAgentTools, 'Enabled', 'Disabled')}`);
  console.log();
  
  console.log(chalk.green('✓ ') + chalk.white('Server ready and listening...'));
  console.log(chalk.gray('─'.repeat(40)));
}

function getStatusIcon(hasFeature: boolean): string {
  return hasFeature ? chalk.green('✓') : chalk.red('✗');
}

function getStatusText(hasFeature: boolean, successText: string, fallbackText: string): string {
  return hasFeature 
    ? chalk.green(successText)
    : chalk.yellow(fallbackText);
}

export function displayServerError(error: Error, port: number) {
  console.log();
  console.log(chalk.red.bold('❌ Server Error'));
  console.log(chalk.red(`Failed to start ThreadScout on port ${port}`));
  console.log(chalk.gray('Error details:'), error.message);
  console.log();
}