'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

async function callTool(server, token, name, args) {
  const response = await fetch(`${server.replace(/\/$/, '')}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `${name} failed with HTTP ${response.status}`);
  }
  return payload.result;
}

/**
 * Uploads the built packages via the Curious Reader CMS MCP endpoint.
 * Requires CR_MCP_SERVER and CR_MCP_TOKEN environment variables; without
 * them this is a documented no-op so packaging still succeeds standalone.
 * @param {{ engineZip: string, languageZips: string[] }} built
 * @param {(line: string) => void} [log]
 */
async function uploadAll(built, log = console.log) {
  const server = process.env.CR_MCP_SERVER;
  const token = process.env.CR_MCP_TOKEN;
  if (!server || !token) {
    log('Upload skipped: set CR_MCP_SERVER and CR_MCP_TOKEN to enable MCP upload.');
    return { skipped: true };
  }

  const engineSlug = CONFIG.engineSlug;
  log(`Connecting to ${server} as engine "${engineSlug}"...`);

  const engines = await callTool(server, token, 'list_engine_slugs', {});
  const known = Array.isArray(engines?.slugs) ? engines.slugs.some((entry) => entry.slug === engineSlug) : false;
  if (!known) {
    log(`Reserving engine slug "${engineSlug}"...`);
    await callTool(server, token, 'create_engine_slug', { slug: engineSlug, confirmed: true });
  }

  log('Uploading engine package...');
  await callTool(server, token, 'upload_core_game', {
    engineSlug,
    title: CONFIG.engineTitle,
    urlTemplate: CONFIG.urlTemplate,
    hasCoreLevel: false,
    filename: path.basename(built.engineZip),
    zipBase64: fs.readFileSync(built.engineZip).toString('base64')
  });

  const results = [];
  for (const zipPath of built.languageZips) {
    const match = path.basename(zipPath).match(/-lang-([a-z]+)\.zip$/);
    const langCode = match ? match[1] : null;
    if (!langCode) continue;
    try {
      log(`Uploading language pack "${langCode}"...`);
      const iconPath = path.join(ROOT, 'lang', langCode, 'icon.png');
      const args = { engineSlug, langCode, filename: path.basename(zipPath), zipBase64: fs.readFileSync(zipPath).toString('base64') };
      if (fs.existsSync(iconPath)) args.iconBase64 = fs.readFileSync(iconPath).toString('base64');
      await callTool(server, token, 'upload_language_pack', args);
      results.push({ langCode, ok: true });
    } catch (error) {
      log(`  "${langCode}" upload failed: ${error.message}`);
      results.push({ langCode, ok: false, error: error.message });
    }
  }

  const failed = results.filter((result) => !result.ok);
  log(failed.length === 0
    ? `Uploaded engine + ${results.length} language pack(s) to the development channel.`
    : `Uploaded with ${failed.length} of ${results.length} language pack(s) failing; see messages above.`);
  return { skipped: false, results };
}

module.exports = { uploadAll };
