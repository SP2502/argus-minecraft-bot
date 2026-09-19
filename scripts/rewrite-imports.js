const fs = require('fs');
const path = require('path');

/**
 * Helper to rewrite require() paths across project files.
 * Usage:
 *   node scripts/rewrite-imports.js --rule "<oldPattern>-><newPattern>" [--dry-run]
 * Or pass a mapping object in code.
 */

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.agents') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function rewriteFileImports(filePath, replacements, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [fromPattern, toPattern] of Object.entries(replacements)) {
    // Regex matches require('fromPattern') or require("fromPattern")
    // If fromPattern is regex or literal string
    const escaped = fromPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`require\\((['"])${escaped}(['"])\\)`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `require($1${toPattern}$2)`);
      changed = true;
    }
  }

  if (changed) {
    if (!dryRun) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    console.log(`[REWRITE] ${filePath} (${dryRun ? 'DRY RUN' : 'UPDATED'})`);
  }
  return changed;
}

function batchRewrite(targetDir, replacements, dryRun = false) {
  const files = getAllJsFiles(targetDir);
  let totalChanged = 0;
  for (const file of files) {
    if (rewriteFileImports(file, replacements, dryRun)) {
      totalChanged++;
    }
  }
  console.log(`Total files modified: ${totalChanged} / ${files.length}`);
}

module.exports = { getAllJsFiles, rewriteFileImports, batchRewrite };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetDir = args.find(a => !a.startsWith('--') && !a.includes('->')) || process.cwd();
  const ruleArg = args.find(a => a.includes('->'));

  if (ruleArg) {
    const [from, to] = ruleArg.split('->');
    batchRewrite(targetDir, { [from.trim()]: to.trim() }, dryRun);
  } else {
    console.log('Usage: node scripts/rewrite-imports.js "<from>-><to>" [--dry-run] [directory]');
  }
}
