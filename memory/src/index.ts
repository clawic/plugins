import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { formatMemory, formatMemoryList } from "./format.js";
import { MemoryStore } from "./store.js";

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export default definePluginEntry({
  id: "memory",
  name: "Memory",
  description: "Manage local memories, topics, reinforcement history, and recall inside OpenClaw",
  register(api) {
    const store = new MemoryStore(api.pluginConfig ?? {});

    api.registerTool({
      name: "memory_remember",
      label: "Remember memory",
      description: "Capture a memory with a summary, optional details, topic, tags, importance, and pinned state",
      parameters: Type.Object({
        summary: Type.String({ minLength: 1 }),
        details: Type.Optional(Type.String()),
        topic: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        importance: Type.Optional(
          Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
        ),
        pinned: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const memory = await store.remember(params);
        return toolTextResult(`Memory stored.\n${formatMemory(memory)}`, {
          status: "created",
          memory,
        });
      },
    });

    api.registerTool({
      name: "memory_recall",
      label: "Recall memories",
      description: "Recall memories by search query, topic, tag, importance, pinned state, or archive visibility",
      parameters: Type.Object({
        search: Type.Optional(Type.String()),
        topic: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        importance: Type.Optional(
          Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
        ),
        pinned: Type.Optional(Type.Boolean()),
        includeArchived: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const memories = await store.recall(params);
        return toolTextResult(formatMemoryList("Matching memories", memories), {
          status: "ok",
          count: memories.length,
          memories,
        });
      },
    });

    api.registerTool({
      name: "memory_get",
      label: "Get memory",
      description: "Fetch one memory with its details and reinforced observations",
      parameters: Type.Object({
        memoryId: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const memory = await store.getMemory(params.memoryId);
        return toolTextResult(
          [
            formatMemory(memory),
            memory.details ? `\nDetails:\n${memory.details}` : "",
            memory.observations.length
              ? `\nObservations:\n${memory.observations.map((entry) => `- ${entry.createdAt}: ${entry.body}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          {
            status: "ok",
            memory,
          },
        );
      },
    });

    api.registerTool({
      name: "memory_update",
      label: "Update memory",
      description: "Update memory fields including summary, details, topic, tags, importance, and pinned state",
      parameters: Type.Object({
        memoryId: Type.String({ minLength: 1 }),
        summary: Type.Optional(Type.String()),
        details: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        topic: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String())),
        addTags: Type.Optional(Type.Array(Type.String())),
        removeTags: Type.Optional(Type.Array(Type.String())),
        importance: Type.Optional(
          Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
        ),
        pinned: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const memory = await store.updateMemory(params);
        return toolTextResult(`Memory updated.\n${formatMemory(memory)}`, {
          status: "updated",
          memory,
        });
      },
    });

    api.registerTool({
      name: "memory_reinforce",
      label: "Reinforce memory",
      description: "Append a timestamped observation or extra context to an existing memory",
      parameters: Type.Object({
        memoryId: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const memory = await store.reinforce(params);
        return toolTextResult(`Observation added.\n${formatMemory(memory)}`, {
          status: "appended",
          memory,
        });
      },
    });

    api.registerTool({
      name: "memory_delete",
      label: "Delete memory",
      description: "Archive a memory by default, or remove it permanently when hardDelete is true",
      parameters: Type.Object({
        memoryId: Type.String({ minLength: 1 }),
        hardDelete: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const result = await store.deleteMemory(params);
        return toolTextResult(
          `Memory ${result.deleted === "removed" ? "deleted permanently" : "archived"}: ${result.memoryId}`,
          { status: result.deleted, memoryId: result.memoryId },
        );
      },
    });
  },
});
