---
name: sync-project-docs
description: Keeps CLAUDE.md and .github/copilot-instructions.md in sync in this repo (gym-system). TRIGGER — use this whenever CLAUDE.md is created or edited in this project, and whenever .github/copilot-instructions.md is created or edited: after finishing that edit, mirror the equivalent substantive content into the other file so Claude Code and GitHub Copilot always see the same project context. Also use when the user asks to "sync the docs", "update project instructions", or similar.
---

# Sync CLAUDE.md ↔ copilot-instructions.md

This repo maintains two AI-assistant instruction files that must stay in sync:

- `CLAUDE.md` (repo root) — read by Claude Code
- `.github/copilot-instructions.md` — read by GitHub Copilot

They share the same substantive sections almost verbatim: **Architecture**, **Data model**, **Auth & permission model**, **Frontend conventions**, **Implementation status**. `CLAUDE.md` additionally has a **Commands** section (build/run/test commands) which `copilot-instructions.md` folds into a shorter "Dev workflow" section instead — that structural difference is intentional and should be preserved, not synced away.

## When to run this

Whenever you (Claude) finish editing either file in this session — after adding a feature, changing architecture, updating implementation status, or otherwise touching either file's content — immediately check whether the other file needs the same update. Don't wait to be asked again; this is the whole point of the skill.

## Steps

1. Read both `CLAUDE.md` and `.github/copilot-instructions.md`.
2. Diff them conceptually section by section (Architecture, Data model, Auth & permission model, Frontend conventions, Implementation status, and any new sections). Identify which file has the newer/more complete information in each shared section.
3. Apply the missing or updated content to whichever file is behind, using each file's own established prose style and heading structure — don't just copy-paste raw text across if the surrounding phrasing doesn't match, but the substance (facts, file paths, conventions, status) must match exactly.
4. Leave file-specific sections alone: `CLAUDE.md`'s `## Commands` block and any Claude-Code-specific tooling notes; `copilot-instructions.md`'s "Dev workflow" framing if it differs in structure. These don't need a mirror in the other file, only the underlying facts (e.g. new npm scripts, new services) need to be reflected in both, each in its own idiom.
5. After edits, do a final read-through of both files to confirm the shared sections now say the same thing (facts, not necessarily identical wording), and report to the user what was synced.

## Notes

- This is a skill, not a hook — it relies on you noticing the trigger condition (you just edited one of these two files) and acting on it within the same turn, before ending your response. If a very long session makes it easy to forget, re-check both files' content near the end of any turn that touched project architecture, conventions, or implementation status.
- Don't invent content for either file. If a change to CLAUDE.md doesn't have an obvious counterpart fact for Copilot's audience (e.g., something purely about Claude Code tooling like a slash command), leave `copilot-instructions.md` alone for that piece.
