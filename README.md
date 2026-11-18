# NEP Guard

### Scanners find risky code in your AI agent's skills. NEP Guard fixes it, and keeps it fixed.

**Zero-trust auto-remediation for Claude Code.** NEP Guard scans every skill, plugin and claude.ai connector you install, verifies each finding in the code, removes the real risk *without breaking what the skill is for*, and re-applies the fix after every update. Every change is backed up, logged, and reversible with one command.

Powered by [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector). Runs locally. Free. Nothing leaves your machine.

[Türkçe](README.tr.md)

---

## What makes it different

Most tools stop at a report or a block. NEP Guard goes one step further.

| | Report a finding | Block or quarantine | **Fix the code and keep it fixed** |
|---|:---:|:---:|:---:|
| Typical scanners | ✅ | sometimes | ❌ |
| **NEP Guard** | ✅ | ✅ (connectors) | ✅ |

- **Fixes, not just flags.** Dangerous or exfiltrating code is deleted when the skill works without it, or neutralized with a minimal guard when it doesn't. Dev-only test files carrying risky patterns are removed.
- **Fixes survive updates.** Fixes are written as *patch packs* and re-applied at every session start, so a plugin update can't silently bring the risk back. If upstream code changed, the patch is skipped and reported, never guessed.
- **Zero trust.** No source is trusted by default, including first-party skills and connectors. Everything is scanned the same way.
- **Your rules outrank tool instructions.** A policy layer is injected into every session. Example: *"ask before paid tools"* beats a connector that says *"only confirm spending for long jobs"*, and connector instructions are treated as untrusted data.
- **Covers claude.ai, too.** Skills synced from claude.ai and claude.ai remote connectors are inventoried and reviewed, not just local files.
- **No babysitting.** Install hooks trigger a scan the moment something is installed. Session hooks catch anything new or changed. You don't run commands.

## Why you can trust it

Auto-editing other people's code is a big ask. NEP Guard is built so you never have to take it on faith:

| Guarantee | How |
|---|---|
| **Reversible** | Originals are backed up before the first change. `rollback <pack>` restores them and keeps the pack disabled. |
| **Auditable** | Every edit, removal, rollback and connector block is written to `~/.nep-guard/changes.log`. |
| **No guessing** | Patches use exact-text anchors. Changed upstream code = patch skipped + warning. |
| **Contained** | A patch pack cannot touch files outside its own plugin directory (enforced and tested). |
| **Pinned reviews** | A reviewed skill is pinned by content hash. Change one byte and the warning comes back. |
| **Local and free** | Scans run with `--no-llm`: file contents are never sent to any model or service. |
| **Tested** | `node test/selftest.js` exercises every guarantee above. |

### We scan ourselves

NEP Guard is scanned with the same engine it uses on everything else. Current result for this repository: **MEDIUM (38/100), 0 high, 0 critical.**
The remaining findings describe what the tool is designed to do, not hidden behavior:

| Finding | Why it is there |
|---|---|
| Autonomous decision making | It remediates without asking. That is the product, and you can turn it off with `"autoRemediate": false`. |
| Session persistence | Fixes are stored as patch packs and re-applied every session, so updates can't undo them. |
| Skill enumeration | It has to list your installed skills to scan them. |
| Bundled hooks | Its SessionStart and PostToolUse hooks are how it runs without commands. |

Reproduce it yourself: `skillspector scan . --no-llm`

## How it works

```
 install a skill / plugin / connector
              │
              ▼
   PostToolUse hook ──► background scan (SkillSpector, local)
              │
              ▼
   Claude follows the nep-guard playbook, without asking:
   verify in code → delete or guard → patch pack → test → rescan → pin
              │
              ▼
   SessionStart hook (every session):
   re-apply patch packs · rescan new/changed skills · inventory claude.ai connectors
   · inject your policy · report anything unreviewed
```

| Component | File |
|---|---|
| Engine (hooks, scans, pins, connectors) | `scripts/nep-guard.js` |
| Patch engine (backup, audit, rollback) | `scripts/lib/patcher.js` |
| Remediation playbook Claude follows | `skills/nep-guard/SKILL.md` |
| Your policy (defaults) | `policy.default.json` |
| Community patch packs | `patches/community/*.json` |

## Install

1. Install the scanning engine once (free, needs [uv](https://docs.astral.sh/uv/)):

   ```bash
   uv tool install --python 3.13 "skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git"
   ```

2. Add NEP Guard to Claude Code:

   ```bash
   claude plugin marketplace add eminhanpehlivan/nep-guard
   ```

   ```bash
   claude plugin install nep-guard@nep-guard
   ```

3. Start a new Claude Code session. NEP Guard scans in the background and reports in the session.

## Commands

You rarely need these; they exist for transparency and control.

```bash
node scripts/nep-guard.js status                              # what is scanned, pinned, blocked
node scripts/nep-guard.js rollback <pack-id>                  # undo a fix
node scripts/nep-guard.js review <skill-dir> "note"           # pin a reviewed skill
node scripts/nep-guard.js review-connector "<name>" "note"    # mark a connector reviewed
node scripts/nep-guard.js block-connector "<name>" "reason"   # deny a connector in every session
```

## Policy

Override any default in `~/.nep-guard/policy.json`:

```json
{
  "language": "tr",
  "autoRemediate": true,
  "askBeforePaidTools": true,
  "connectorInstructionsUntrusted": true,
  "applyCommunityPacks": true,
  "connectorCheckMinutes": 60,
  "extraRules": ["Never install packages from unverified registries."]
}
```

## Patch packs

A patch pack is a small JSON file. Community packs live in `patches/community/`; your own (often written by Claude while remediating) go in `~/.nep-guard/patches/`.

```json
{
  "id": "example-network-off",
  "plugin": "example@marketplace",
  "description": "What was risky and what still works",
  "edits": [{ "file": "skills/x/send.py", "start": "def send(", "end": "\n\n\ndef ", "replace": "def send(*a, **k):\n    raise RuntimeError(\"disabled\")" }],
  "remove": ["skills/x/tests"]
}
```

## Honest limits

- **Remote connectors run on someone else's server.** NEP Guard reviews what the agent reads (instructions, tool descriptions) and can deny a connector, but it cannot see what the server itself does.
- **Claude Code only.** The hooks run inside Claude Code (CLI, desktop Code tab, IDE extensions). Plain claude.ai web/mobile chats are not covered.
- **Remediation needs a session.** Detection and re-applying known fixes are automatic; deciding a *new* fix is done by Claude in your next session, following the playbook. Nothing edits code while no session is running.
- **Optional features may be switched off.** When a feature's only job is sending data off-machine, it gets disabled (with a clear message), while the skill's main purpose keeps working.

## Related projects

NEP Guard stands on, and is complementary to, great work by others:

- [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector): the scanning engine NEP Guard uses.
- [snyk/agent-scan](https://github.com/snyk/agent-scan): scanner for agents, MCP servers and skills; fetches live tool descriptions from remote MCP servers. A good companion for deep connector audits.
- [cisco-ai-defense/skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) and [Tencent/AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard): skill and agent scanners.
- [hashgraph-online/hol-guard](https://github.com/hashgraph-online/hol-guard): runtime firewall that reviews agent actions before they run.
- [T-Zevin/SkillGuardrail](https://github.com/T-Zevin/SkillGuardrail): quarantine-first guarded installer.
- [eric-sabe/honey](https://github.com/eric-sabe/honey): daily supply-chain watchdog with drafted remediation advice.

Their focus is detection, blocking or advice. NEP Guard's focus is the step after: **applying the fix and keeping it applied.**
*(Comparison based on each project's public README, November 2026.)*

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). NEP Guard is not affiliated with or endorsed by NVIDIA, Anthropic or Snyk.
