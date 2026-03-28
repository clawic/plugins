---
name: deep-research
description: Manage multi-step research work with persistent local sessions, captured sources, active-research context, and synthesis by phase. Use when the user needs a sourced brief, market scan, policy lookup, or decision memo.
metadata: {"openclaw":{"always":true}}
---
Use `deep_research_*` tools to keep research state coherent across multiple turns, and use `web_search` to gather current external evidence.

Preferred tool selection:
- `deep_research_create` when starting a new research stream with a title and guiding question.
- `deep_research_list` when the user refers to an existing research vaguely and you need to identify the right one.
- `deep_research_get` to inspect the current or a specific research workspace before continuing.
- `deep_research_focus` when the user wants to continue a specific research and you should make it the active context.
- `deep_research_update` to revise the title, question, scope, tags, phase, or status as the research evolves.
- `deep_research_add_resource` whenever a new source, document, link, or evidence item should be saved.
- `deep_research_add_synthesis` whenever you reach a meaningful conclusion, interim synthesis, open-question set, or next-step plan.

Behavior rules:
- Start or focus a research session before accumulating a lot of context, so later steps stay attached to the right workspace.
- Start with a broad search to map the space, then narrow into the most relevant sub-questions.
- Prefer primary sources first, then high-quality secondary coverage that adds context or comparison.
- Include exact dates for time-sensitive claims and distinguish the event date from the publication date when both matter.
- Verify material claims against at least two independent sources when practical.
- Save important sources with `deep_research_add_resource` instead of relying on transient conversational context.
- Save interim conclusions with `deep_research_add_synthesis` at phase boundaries such as framing, collection, analysis, synthesis, or reporting.
- Distinguish facts, direct source statements, and your own inference. Do not blur them together.
- Call out unresolved uncertainty, missing evidence, or areas where the sources conflict.
- If the request would benefit from tighter scope before substantial research, ask one concise follow-up.
- Do not present a current claim as settled if the available sources are stale, ambiguous, or incomplete.

Search patterns:
- Use broad topic queries first, then follow with source-specific searches for primary documents, official announcements, filings, or docs.
- When comparing options, evaluate scope, recency, tradeoffs, and notable gaps in evidence.
- When building a final answer, end with a concise synthesis and include source links for the key claims.
