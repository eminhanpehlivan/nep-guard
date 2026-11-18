'use strict';
// Patch engine: applies JSON "patch packs" to installed plugin files, idempotently.
// Every change is backed up first, written to an audit log, and can be rolled back.
// Anchors are exact text: if upstream code changed, the edit is skipped and reported, never guessed.
const fs = require('fs');
const path = require('path');

/**
 * Patch pack shape (JSON):
 * {
 *   "id": "claude-mem-network-off",
 *   "plugin": "claude-mem@thedotmack",        // key in ~/.claude/plugins/installed_plugins.json
 *   "description": "why this patch exists",
 *   "edits":  [{ "file": "skills/x/a.js", "start": "exact text", "end": "exact text or null", "replace": "new text" }],
 *   "remove": ["skills/x/tests"]               // dev-only files/dirs, relative to the plugin install path
 * }
 * edit semantics: replace from `start` up to (not including) `end`; end === null replaces `start` itself.
 */

function loadPacks(dirs) {
  const packs = [];
  for (const dir of dirs) {
    let names = [];
    try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort(); } catch { continue; }
    for (const n of names) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
        if (p && p.id && p.plugin) packs.push({ ...p, _file: path.join(dir, n) });
      } catch (e) { packs.push({ id: n, _error: `invalid JSON: ${e.message}` }); }
    }
  }
  return packs;
}

function installPaths(claudeDir) {
  try {
    const ip = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins', 'installed_plugins.json'), 'utf8'));
    const out = {};
    for (const [name, v] of Object.entries(ip.plugins || ip)) {
      const e = [].concat(v || [])[0];
      if (e && e.installPath) out[name] = { root: e.installPath, version: e.version || path.basename(e.installPath) };
    }
    return out;
  } catch { return {}; }
}

// Resolve `rel` under `root`, refusing anything that escapes it (a pack must never touch files outside its plugin).
function inside(root, rel) {
  const abs = path.resolve(root, rel);
  const r = path.resolve(root);
  if (abs !== r && !abs.startsWith(r + path.sep)) throw new Error(`path escapes plugin root: ${rel}`);
  return abs;
}

function backup(dataDir, pack, version, root, abs) {
  const dest = path.join(dataDir, 'backups', pack.id, String(version), path.relative(root, abs));
  if (fs.existsSync(dest)) return; // first (original) copy wins
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(abs, dest, { recursive: true });
}

function audit(dataDir, line) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(path.join(dataDir, 'changes.log'), `${new Date().toISOString()} ${line}\n`);
}

/** Apply all packs. Returns { changed, warnings, applied: [{id, file, action}] }. */
function applyAll({ packDirs, dataDir, claudeDir, disabled = [] }) {
  const res = { changed: 0, warnings: [], applied: [] };
  const plugins = installPaths(claudeDir);
  for (const pack of loadPacks(packDirs)) {
    if (pack._error) { res.warnings.push(`${pack.id}: ${pack._error}`); continue; }
    if (disabled.includes(pack.id)) continue; // rolled back by the user: never re-apply
    const pl = plugins[pack.plugin];
    if (!pl) continue; // plugin not installed: nothing to do
    for (const ed of pack.edits || []) {
      let f;
      try { f = inside(pl.root, ed.file); } catch (e) { res.warnings.push(`${pack.id}: ${e.message}`); continue; }
      if (!fs.existsSync(f)) { res.warnings.push(`${pack.id}: missing ${ed.file}`); continue; }
      const src = fs.readFileSync(f, 'utf8');
      if (src.includes(ed.replace)) continue; // already applied
      const i = src.indexOf(ed.start);
      const j = ed.end == null ? i + ed.start.length : src.indexOf(ed.end, i);
      if (i < 0 || j < 0) { res.warnings.push(`${pack.id}: anchor not found in ${ed.file} (upstream changed? edit skipped)`); continue; }
      backup(dataDir, pack, pl.version, pl.root, f);
      fs.writeFileSync(f, src.slice(0, i) + ed.replace + src.slice(j));
      res.changed++; res.applied.push({ id: pack.id, file: ed.file, action: 'edit' });
      audit(dataDir, `EDIT ${pack.id} ${pack.plugin}@${pl.version} ${ed.file}`);
    }
    for (const rel of pack.remove || []) {
      let p;
      try { p = inside(pl.root, rel); } catch (e) { res.warnings.push(`${pack.id}: ${e.message}`); continue; }
      if (!fs.existsSync(p)) continue;
      backup(dataDir, pack, pl.version, pl.root, p);
      fs.rmSync(p, { recursive: true, force: true });
      res.changed++; res.applied.push({ id: pack.id, file: rel, action: 'remove' });
      audit(dataDir, `REMOVE ${pack.id} ${pack.plugin}@${pl.version} ${rel}`);
    }
  }
  return res;
}

/** Restore every backed-up file of a pack for the currently installed version. */
function rollback({ packId, packDirs, dataDir, claudeDir }) {
  const pack = loadPacks(packDirs).find(p => p.id === packId);
  if (!pack) throw new Error(`unknown pack: ${packId}`);
  const pl = installPaths(claudeDir)[pack.plugin];
  if (!pl) throw new Error(`plugin not installed: ${pack.plugin}`);
  const src = path.join(dataDir, 'backups', pack.id, String(pl.version));
  if (!fs.existsSync(src)) throw new Error(`no backup for ${packId} @ ${pl.version}`);
  fs.cpSync(src, pl.root, { recursive: true, force: true });
  audit(dataDir, `ROLLBACK ${pack.id} ${pack.plugin}@${pl.version}`);
  return { restoredFrom: src, to: pl.root };
}

module.exports = { loadPacks, installPaths, applyAll, rollback, inside };
