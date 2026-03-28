import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import {
  formatResearch,
  formatResearchDetail,
  formatResearchList,
  formatResearchResource,
  formatResearchSynthesis,
} from "./format.js";
import { DeepResearchStore } from "./store.js";

const phaseSchema = Type.Union([
  Type.Literal("framing"),
  Type.Literal("collection"),
  Type.Literal("analysis"),
  Type.Literal("synthesis"),
  Type.Literal("reporting"),
]);

const statusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("paused"),
  Type.Literal("completed"),
  Type.Literal("archived"),
]);

const sourceTypeSchema = Type.Union([
  Type.Literal("web"),
  Type.Literal("paper"),
  Type.Literal("document"),
  Type.Literal("dataset"),
  Type.Literal("interview"),
  Type.Literal("note"),
  Type.Literal("other"),
]);

const confidenceSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export default definePluginEntry({
  id: "deep-research",
  name: "Deep Research",
  description: "Manage local research workspaces, captured sources, and synthesis inside OpenClaw",
  register(api) {
    const store = new DeepResearchStore(api.pluginConfig ?? {});

    api.registerTool({
      name: "deep_research_create",
      label: "Create research",
      description: "Create a new deep research workspace with a title, guiding question, scope, tags, and initial phase",
      parameters: Type.Object({
        title: Type.String({ minLength: 1 }),
        question: Type.String({ minLength: 1 }),
        objective: Type.Optional(Type.String()),
        scope: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        phase: Type.Optional(phaseSchema),
        setActive: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const research = await store.createResearch(params);
        return toolTextResult(`Research created.\n${formatResearch(research)}`, {
          status: "created",
          research,
        });
      },
    });

    api.registerTool({
      name: "deep_research_list",
      label: "List research",
      description: "List research workspaces by search query, status, phase, tag, or archive visibility",
      parameters: Type.Object({
        search: Type.Optional(Type.String()),
        status: Type.Optional(statusSchema),
        phase: Type.Optional(phaseSchema),
        tag: Type.Optional(Type.String()),
        includeArchived: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const researches = await store.listResearch(params);
        const activeResearchId = await store.getActiveResearchId();
        return toolTextResult(formatResearchList("Matching research", researches, activeResearchId), {
          status: "ok",
          count: researches.length,
          activeResearchId,
          researches,
        });
      },
    });

    api.registerTool({
      name: "deep_research_get",
      label: "Get research",
      description: "Fetch the active research workspace, or a specific one when researchId is provided",
      parameters: Type.Object({
        researchId: Type.Optional(Type.String({ minLength: 1 })),
      }),
      async execute(_id, params) {
        const research = await store.getResearch(params.researchId);
        const activeResearchId = await store.getActiveResearchId();
        return toolTextResult(formatResearchDetail(research, activeResearchId), {
          status: "ok",
          activeResearchId,
          research,
        });
      },
    });

    api.registerTool({
      name: "deep_research_update",
      label: "Update research",
      description: "Update research metadata such as title, question, scope, tags, phase, or status",
      parameters: Type.Object({
        researchId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String()),
        question: Type.Optional(Type.String()),
        objective: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        scope: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String())),
        addTags: Type.Optional(Type.Array(Type.String())),
        removeTags: Type.Optional(Type.Array(Type.String())),
        phase: Type.Optional(phaseSchema),
        status: Type.Optional(statusSchema),
      }),
      async execute(_id, params) {
        const research = await store.updateResearch(params);
        return toolTextResult(`Research updated.\n${formatResearch(research)}`, {
          status: "updated",
          research,
        });
      },
    });

    api.registerTool({
      name: "deep_research_focus",
      label: "Focus research",
      description: "Set the active research workspace so later source capture and synthesis can omit researchId",
      parameters: Type.Object({
        researchId: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const research = await store.focusResearch(params.researchId);
        return toolTextResult(`Active research set.\n${formatResearch(research)}`, {
          status: "focused",
          research,
        });
      },
    });

    api.registerTool({
      name: "deep_research_add_resource",
      label: "Add resource",
      description: "Save a source, document, or evidence item to the active research or a specified workspace",
      parameters: Type.Object({
        researchId: Type.Optional(Type.String({ minLength: 1 })),
        title: Type.String({ minLength: 1 }),
        url: Type.Optional(Type.String()),
        sourceType: Type.Optional(sourceTypeSchema),
        summary: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String()),
        author: Type.Optional(Type.String()),
        publishedAt: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const { research, resource } = await store.addResource(params);
        return toolTextResult(`Resource saved.\n${formatResearchResource(resource)}`, {
          status: "saved",
          research,
          resource,
        });
      },
    });

    api.registerTool({
      name: "deep_research_add_synthesis",
      label: "Add synthesis",
      description: "Save an interim or final synthesis entry for the active research or a specified workspace",
      parameters: Type.Object({
        researchId: Type.Optional(Type.String({ minLength: 1 })),
        phase: Type.Optional(phaseSchema),
        title: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
        confidence: Type.Optional(confidenceSchema),
        openQuestions: Type.Optional(Type.Array(Type.String())),
        nextSteps: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_id, params) {
        const { research, synthesis } = await store.addSynthesis(params);
        return toolTextResult(`Synthesis saved.\n${formatResearchSynthesis(synthesis)}`, {
          status: "saved",
          research,
          synthesis,
        });
      },
    });
  },
});
