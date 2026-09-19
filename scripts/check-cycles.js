const fs = require('fs');
const path = require('path');

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.agents' || file === 'coverage') continue;
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

function resolveRequire(sourceFile, requirePath) {
  if (!requirePath.startsWith('.')) {
    // External package or subpath alias
    return null;
  }
  const dir = path.dirname(sourceFile);
  const candidate = path.resolve(dir, requirePath);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  if (fs.existsSync(candidate + '.js')) {
    return candidate + '.js';
  }
  if (fs.existsSync(candidate + '.json')) {
    return candidate + '.json';
  }
  if (fs.existsSync(path.join(candidate, 'index.js'))) {
    return path.join(candidate, 'index.js');
  }
  return null;
}

function extractRequires(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const results = [];
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    const target = resolveRequire(filePath, match[1]);
    if (target && (target.endsWith('.js') || target.endsWith('.mjs'))) {
      results.push(target);
    }
  }
  return results;
}

function findCycles(graph) {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cycle);
      }
    }

    recStack.delete(node);
    path.pop();
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

function checkCircularDependencies(targetDir = '.') {
  const allFiles = getAllJsFiles(targetDir);
  const graph = {};

  for (const file of allFiles) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const deps = extractRequires(file).map(d => path.relative(process.cwd(), d).replace(/\\/g, '/'));
    graph[rel] = deps;
  }

  const rawCycles = findCycles(graph);
  // Deduplicate cycles by canonical rotation
  const uniqueCycles = [];
  const seenSignatures = new Set();

  for (const cycle of rawCycles) {
    const nodes = cycle.slice(0, -1);
    const minNode = nodes.reduce((min, cur) => cur < min ? cur : min, nodes[0]);
    const minIdx = nodes.indexOf(minNode);
    const rotated = nodes.slice(minIdx).concat(nodes.slice(0, minIdx));
    const sig = rotated.join(' -> ');
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      uniqueCycles.push(cycle);
    }
  }

  return { graph, uniqueCycles };
}

module.exports = { checkCircularDependencies };

if (require.main === module) {
  const targetDir = process.argv[2] || '.';
  console.log(`Checking circular dependencies in: ${targetDir}`);
  const { uniqueCycles } = checkCircularDependencies(targetDir);
  if (uniqueCycles.length === 0) {
    console.log('No circular dependencies found!');
    process.exit(0);
  } else {
    console.log(`Found ${uniqueCycles.length} circular dependenc${uniqueCycles.length === 1 ? 'y' : 'ies'}:`);
    uniqueCycles.forEach((c, idx) => {
      console.log(`\nCycle ${idx + 1}:`);
      console.log('  ' + c.join('\n  -> '));
    });
    process.exit(1);
  }
}
