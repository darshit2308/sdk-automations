const fs = require('node:fs');
const path = require('node:path');

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of text.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)[0].length;
    const line = withoutComment.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;

    if (line.startsWith('- ')) {
      if (!Array.isArray(parent)) {
        throw new Error(`Invalid YAML list item without list parent: ${line}`);
      }
      parent.push(parseScalar(line.slice(2)));
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(`Invalid YAML line: ${line}`);
    }

    const key = line.slice(0, separator).trim();
    const valueText = line.slice(separator + 1).trim();

    if (valueText) {
      parent[key] = parseScalar(valueText);
      continue;
    }

    const nextContainer = {};
    parent[key] = nextContainer;
    stack.push({ indent, value: nextContainer, key, parent });
  }

  convertArrayPlaceholders(root);
  return root;
}

function convertArrayPlaceholders(value) {
  if (!value || typeof value !== 'object') return value;

  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      continue;
    }

    const entries = Object.entries(child);
    if (entries.length === 0) continue;

    const numericKeys = entries.every(([entryKey]) => /^\d+$/.test(entryKey));
    if (numericKeys) {
      value[key] = entries
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, entryValue]) => entryValue);
    } else {
      convertArrayPlaceholders(child);
    }
  }

  return value;
}

function normalizeYamlLists(text) {
  const lines = text.split(/\r?\n/);
  const output = [];
  const listCounters = new Map();

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s+(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const indent = match[1].length;
    const index = listCounters.get(indent) || 0;
    listCounters.set(indent, index + 1);
    output.push(`${match[1]}${index}: ${match[2]}`);
  }

  return output.join('\n');
}

function parseConfig(text, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return JSON.parse(text);
  if (ext === '.yml' || ext === '.yaml') return parseSimpleYaml(normalizeYamlLists(text));
  throw new Error(`Unsupported config file extension: ${ext}`);
}

function loadConfig(configPath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const resolvedPath = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  return parseConfig(fs.readFileSync(resolvedPath, 'utf8'), resolvedPath);
}

module.exports = { loadConfig, parseConfig, parseSimpleYaml };
