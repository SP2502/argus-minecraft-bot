#!/usr/bin/env node

/**
 * Deterministic Checksum Generator for Argus
 *
 * Recursively scans workspace source files, excludes ephemeral and release artifacts,
 * sorts paths with stable lexical ordering, and produces deterministic SHA-256 manifests.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Directories to exclude entirely from checksum scanning
const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'logs',
  'runtime',
  'coverage',
  '.agents'
]);

// File patterns to exclude
function isExcludedFile(fileName) {
  if (fileName === '.env' || fileName === '.env.local') return true;
  if (/^\.env\..*\.local$/.test(fileName)) return true;
  if (fileName.endsWith('.log')) return true;
  if (fileName.endsWith('.zip')) return true;
  if (fileName.endsWith('.tmp')) return true;
  return false;
}

/**
 * Parse CLI arguments
 * Supports:
 *   node scripts/generate-checksums.js
 *   node scripts/generate-checksums.js --output docs/quality/current-sha256sums.txt
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = null;
  let rootDir = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (args[i] === '--dir' || args[i] === '-d') {
      rootDir = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node scripts/generate-checksums.js [--output <path>] [--dir <path>]');
      process.exit(0);
    }
  }

  return { outputPath, rootDir: path.resolve(rootDir) };
}

/**
 * Recursively collect all qualifying files from the directory.
 * Returns array of normalized relative paths starting with './'.
 */
function collectFiles(rootDir, currentDir = rootDir, resolvedOutputFile = null) {
  const results = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      results.push(...collectFiles(rootDir, fullPath, resolvedOutputFile));
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) {
        continue;
      }
      if (resolvedOutputFile && path.resolve(fullPath) === resolvedOutputFile) {
        continue;
      }

      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      results.push({
        fullPath,
        relPath: './' + relPath
      });
    }
  }

  return results;
}

/**
 * Compute SHA-256 hash of a file buffer.
 */
function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Main execution function
 */
function main() {
  const { outputPath, rootDir } = parseArgs();
  const resolvedOutputFile = outputPath ? path.resolve(outputPath) : null;

  const files = collectFiles(rootDir, rootDir, resolvedOutputFile);

  // Stable lexical ordering
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const lines = [];
  for (const file of files) {
    const hash = hashFile(file.fullPath);
    lines.push(`${hash}  ${file.relPath}`);
  }

  const outputContent = lines.join('\n') + '\n';

  if (resolvedOutputFile) {
    const outputDir = path.dirname(resolvedOutputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Atomic write via temporary file
    const tempFile = path.join(outputDir, `.checksums-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    fs.writeFileSync(tempFile, outputContent, 'utf8');
    fs.renameSync(tempFile, resolvedOutputFile);
    console.error(`Wrote ${files.length} checksums atomically to: ${resolvedOutputFile}`);
  } else {
    process.stdout.write(outputContent);
  }
}

if (require.main === module) {
  main();
}

module.exports = { collectFiles, hashFile, parseArgs };
