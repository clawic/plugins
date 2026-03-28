# Deep Research Plugin

Native OpenClaw plugin for managing multi-step research projects locally.

It gives the agent a persistent research workspace with:

- multiple research sessions tracked by id and title
- an active research context so follow-up steps can keep using the same workspace
- captured resources with URLs, summaries, notes, and source metadata
- synthesis entries by phase so findings can evolve from framing to reporting

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable deep-research
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      "deep-research": {
        enabled: true,
        config: {
          storagePath: "~/.openclaw/state/deep-research/research.json",
        },
      },
    },
  },
}
```

If `storagePath` is omitted, the plugin stores data in `~/.openclaw/state/deep-research/research.json`.

## Tools

- `deep_research_create`
- `deep_research_list`
- `deep_research_get`
- `deep_research_update`
- `deep_research_focus`
- `deep_research_add_resource`
- `deep_research_add_synthesis`

## Usage

After enabling `deep-research`, ask for things like:

- Research the latest browser MCP support across major AI coding tools and give me a sourced comparison.
- Build a brief on EU AI Act enforcement timelines with exact dates, primary sources, and open questions.
- Compare three vendors in the passwordless auth space and separate confirmed facts from marketing claims.

The agent can create a research session, keep it active across steps, save resources as they are found, and append synthesis notes for each phase.
