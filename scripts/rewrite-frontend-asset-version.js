#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INDEX_FILE = 'index.html';
const LOCAL_ASSET_PROTOCOL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    frontendDir: path.resolve(__dirname, '..', 'frontend'),
    indexFile: DEFAULT_INDEX_FILE,
    version: '',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--frontend-dir') {
      options.frontendDir = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--index-file') {
      options.indexFile = argv[index + 1] || DEFAULT_INDEX_FILE;
      index += 1;
    } else if (arg === '--version') {
      options.version = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function assertVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error('Missing required --version value');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(version)) {
    throw new Error('Asset version may only contain letters, numbers, dots, underscores, and dashes');
  }
}

function isLocalAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url || url.startsWith('#')) return false;
  return !LOCAL_ASSET_PROTOCOL_PATTERN.test(url);
}

function withAssetVersion(assetUrl, version) {
  assertVersion(version);
  const original = String(assetUrl || '');
  const hashIndex = original.indexOf('#');
  const beforeHash = hashIndex >= 0 ? original.slice(0, hashIndex) : original;
  const hash = hashIndex >= 0 ? original.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  params.set('v', version);
  return `${pathname}?${params.toString()}${hash}`;
}

function getAttribute(tag, attrName) {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*(['"])([^'"]*)\\1`, 'i');
  const match = pattern.exec(tag);
  return match ? match[2] : '';
}

function replaceAttribute(tag, attrName, replaceValue) {
  const pattern = new RegExp(`\\b(${attrName}\\s*=\\s*)(['"])([^'"]*)(\\2)`, 'i');
  return tag.replace(pattern, (full, prefix, quote, value, suffix) => (
    `${prefix}${quote}${replaceValue(value)}${suffix}`
  ));
}

function isStylesheetLink(tag) {
  const rel = getAttribute(tag, 'rel');
  return rel.split(/\s+/).some((item) => item.toLowerCase() === 'stylesheet');
}

function rewriteHtmlAssetVersions(html, version) {
  assertVersion(version);
  let updated = 0;
  const rewritten = String(html || '').replace(/<\s*(script|link)\b[^>]*>/gi, (tag, tagName) => {
    const normalizedTagName = String(tagName || '').toLowerCase();
    const attrName = normalizedTagName === 'script' ? 'src' : 'href';
    if (normalizedTagName === 'link' && !isStylesheetLink(tag)) return tag;
    const assetUrl = getAttribute(tag, attrName);
    if (!isLocalAssetUrl(assetUrl)) return tag;
    const nextUrl = withAssetVersion(assetUrl, version);
    if (nextUrl === assetUrl) return tag;
    updated += 1;
    return replaceAttribute(tag, attrName, () => nextUrl);
  });
  return { html: rewritten, updated };
}

function rewriteFrontendIndex(options = {}) {
  const frontendDir = path.resolve(options.frontendDir || path.join(__dirname, '..', 'frontend'));
  const indexFile = options.indexFile || DEFAULT_INDEX_FILE;
  const version = options.version || '';
  assertVersion(version);

  const indexPath = path.resolve(frontendDir, indexFile);
  if (!indexPath.startsWith(`${frontendDir}${path.sep}`) && indexPath !== frontendDir) {
    throw new Error(`Index file escapes frontend directory: ${indexFile}`);
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  const result = rewriteHtmlAssetVersions(html, version);
  if (!options.dryRun && result.html !== html) {
    fs.writeFileSync(indexPath, result.html);
  }
  return {
    indexPath,
    version,
    updated: result.updated,
    changed: result.html !== html,
  };
}

function main() {
  const options = parseArgs();
  const result = rewriteFrontendIndex(options);
  console.log(`[frontend-asset-version] ${options.dryRun ? 'checked' : 'rewrote'} ${result.updated} asset urls in ${result.indexPath} with v=${result.version}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[frontend-asset-version] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  isLocalAssetUrl,
  withAssetVersion,
  rewriteHtmlAssetVersions,
  rewriteFrontendIndex,
};
