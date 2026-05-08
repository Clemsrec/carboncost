#!/usr/bin/env node

/**
 * Smoke test runner using npm pack
 * 
 * This script:
 * 1. Builds the entire workspace
 * 2. Generates npm pack archives for each publishable package
 * 3. Installs them into the smoke-tests/consumer-ts project
 * 4. Runs TypeScript typecheck on the consumer
 * 5. Runs runtime smoke tests
 * 6. Verifies script-tag bundle integrity
 */

import { execSync } from 'child_process';
import { mkdtempSync, cpSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const consumerTemplateDir = resolve(__dirname, 'consumer-ts');
const packDir = resolve(rootDir, 'packages');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.blue}════════════════════════════════${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}════════════════════════════════${colors.reset}\n`),
};

const exitWithError = (msg) => {
  log.error(msg);
  process.exit(1);
};

const runCommand = (cmd, opts = {}) => {
  const { cwd = rootDir, silent = false } = opts;
  try {
    const output = execSync(cmd, { cwd, stdio: silent ? 'pipe' : 'inherit' });
    return silent ? output.toString().trim() : '';
  } catch (error) {
    exitWithError(`Command failed: ${cmd}`);
  }
};

/**
 * Phase 1: Build the workspace
 */
const buildWorkspace = () => {
  log.header('Phase 1: Building Workspace');
  log.info('Running: pnpm build');
  runCommand('pnpm build');
  log.success('Workspace built');
};

/**
 * Phase 2: Generate npm pack archives
 */
const generatePackArchives = () => {
  log.header('Phase 2: Generating npm Pack Archives');

  const packages = [
    { name: 'carbone-cost', dir: 'core' },
    { name: '@clemsrec/browser', dir: 'browser' },
    { name: '@clemsrec/script-tag', dir: 'script-tag' },
    { name: '@clemsrec/next', dir: 'next' },
  ];

  const archives = [];

  for (const pkg of packages) {
    const pkgDir = resolve(packDir, pkg.dir);
    log.info(`Packing ${pkg.name}...`);

    try {
      const output = execSync('npm pack --json --silent', {
        cwd: pkgDir,
        stdio: 'pipe',
      }).toString();

      const packInfo = JSON.parse(output);
      const archive = resolve(pkgDir, packInfo[0].filename);

      if (!existsSync(archive)) {
        exitWithError(`Archive not found: ${archive}`);
      }

      archives.push({ name: pkg.name, path: archive });
      log.success(`Packed: ${packInfo[0].filename}`);
    } catch (error) {
      exitWithError(`Failed to pack ${pkg.name}: ${error.message}`);
    }
  }

  return archives;
};

/**
 * Phase 3: Prepare consumer project
 */
const prepareConsumer = () => {
  log.header('Phase 3: Preparing Consumer Project');

  const tempConsumerDir = mkdtempSync(resolve(tmpdir(), 'carbone-smoke-consumer-'));

  log.info(`Copying consumer template to ${tempConsumerDir}...`);
  cpSync(consumerTemplateDir, tempConsumerDir, {
    recursive: true,
    force: true,
    filter: (source) => !source.includes('/node_modules') && !source.includes('/dist')
  });

  log.success('Consumer prepared');
  return tempConsumerDir;
};

/**
 * Phase 4: Install pack archives
 */
const installArchives = (consumerDir, archives) => {
  log.header('Phase 4: Installing Pack Archives');

  const archiveArgs = archives.map((a) => a.path).join(' ');

  log.info('Installing consumer dev dependencies...');
  runCommand('pnpm install --no-frozen-lockfile', { cwd: consumerDir });

  log.info(`Installing ${archives.length} packed packages into consumer...`);
  runCommand(`pnpm add ${archiveArgs}`, { cwd: consumerDir });

  log.success('All archives installed');

  // Verify installation
  log.info('Verifying installation...');
  const nodeModulesDir = resolve(consumerDir, 'node_modules');

  for (const archive of archives) {
    const pkgName = archive.name.split('/').pop();
    const pkgPath = archive.name.includes('@')
      ? resolve(nodeModulesDir, archive.name)
      : resolve(nodeModulesDir, pkgName);

    if (!existsSync(pkgPath)) {
      exitWithError(`Package not found after install: ${archive.name}`);
    }
  }

  log.success('All packages verified in node_modules');
};

/**
 * Phase 5: TypeScript typecheck
 */
const runTypecheck = (consumerDir) => {
  log.header('Phase 5: TypeScript Typecheck');

  log.info('Running: tsc --noEmit');
  runCommand('pnpm typecheck', { cwd: consumerDir });

  log.success('TypeScript typecheck passed');
};

/**
 * Phase 6: Build consumer
 */
const buildConsumer = (consumerDir) => {
  log.header('Phase 6: Building Consumer');

  log.info('Running: tsc -p tsconfig.json');
  runCommand('pnpm build', { cwd: consumerDir });

  log.success('Consumer built successfully');
};

/**
 * Phase 7: Runtime smoke test
 */
const runRuntimeTests = (consumerDir) => {
  log.header('Phase 7: Running Runtime Tests');

  log.info('Executing smoke-runtime.ts...');
  runCommand('pnpm smoke', { cwd: consumerDir });

  log.success('Runtime tests passed');
};

/**
 * Phase 8: Verify script-tag bundle
 */
const verifyScriptTagBundle = (consumerDir) => {
  log.header('Phase 8: Verifying Script-Tag Bundle');

  const bundleDir = resolve(consumerDir, 'node_modules', '@clemsrec', 'script-tag', 'dist');
  const bundleFile = resolve(bundleDir, 'carbon-site-kit.min.js');
  const dtsFile = resolve(bundleDir, 'carbon-site-kit.d.ts');

  if (!existsSync(bundleFile)) {
    exitWithError(`Script-tag bundle not found: ${bundleFile}`);
  }

  if (!existsSync(dtsFile)) {
    exitWithError(`Script-tag declarations not found: ${dtsFile}`);
  }

  log.success(`Bundle verified: ${bundleFile}`);
  log.success(`Declarations verified: ${dtsFile}`);
};

/**
 * Main execution
 */
const main = async () => {
  console.log('\n');
  log.header('🔬 Carbone Package Smoke Test (npm pack)');

  let consumerDir;

  try {
    buildWorkspace();
    const archives = generatePackArchives();
    consumerDir = prepareConsumer();
    installArchives(consumerDir, archives);
    runTypecheck(consumerDir);
    buildConsumer(consumerDir);
    runRuntimeTests(consumerDir);
    verifyScriptTagBundle(consumerDir);

    log.header('🎉 All Smoke Tests Passed!');

    console.log(`${colors.green}Summary:${colors.reset}`);
    console.log(`  ✅ Built: workspace`);
    console.log(`  ✅ Packed: ${archives.map((a) => a.name).join(', ')}`);
    console.log(`  ✅ Installed: all packages into consumer`);
    console.log(`  ✅ TypeScript: no errors`);
    console.log(`  ✅ Runtime: all tests passed`);
    console.log(`  ✅ Script-tag: bundle verified`);
    console.log('');

    process.exit(0);
  } catch (error) {
    exitWithError(`Smoke test failed: ${error.message}`);
  } finally {
    if (consumerDir && existsSync(consumerDir)) {
      rmSync(consumerDir, { recursive: true, force: true });
    }
  }
};

main();
