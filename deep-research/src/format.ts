import type { Research, ResearchResource, ResearchSynthesis } from "./types.js";

export function formatResearch(research: Research, activeResearchId?: string): string {
  const parts = [
    `${research.id}: ${research.title}`,
    `status=${research.status}`,
    `phase=${research.phase}`,
  ];

  if (activeResearchId && research.id === activeResearchId) {
    parts.push("active=yes");
  }
  if (research.tags.length) {
    parts.push(`tags=${research.tags.join(", ")}`);
  }
  if (research.resources.length) {
    parts.push(`resources=${research.resources.length}`);
  }
  if (research.syntheses.length) {
    parts.push(`syntheses=${research.syntheses.length}`);
  }

  return parts.join(" | ");
}

export function formatResearchList(
  label: string,
  researches: Research[],
  activeResearchId?: string,
): string {
  if (!researches.length) {
    return `${label}: none`;
  }
  return `${label}:\n${researches.map((research) => `- ${formatResearch(research, activeResearchId)}`).join("\n")}`;
}

export function formatResearchDetail(research: Research, activeResearchId?: string): string {
  const sections = [
    formatResearch(research, activeResearchId),
    `Question: ${research.question}`,
  ];

  if (research.objective) {
    sections.push(`Objective: ${research.objective}`);
  }
  if (research.scope) {
    sections.push(`Scope: ${research.scope}`);
  }
  if (research.resources.length) {
    sections.push(
      `Resources:\n${research.resources.map((resource) => `- ${formatResearchResource(resource)}`).join("\n")}`,
    );
  }
  if (research.syntheses.length) {
    sections.push(
      `Syntheses:\n${research.syntheses.map((synthesis) => `- ${formatResearchSynthesis(synthesis)}`).join("\n")}`,
    );
  }

  return sections.join("\n");
}

export function formatResearchResource(resource: ResearchResource): string {
  const parts = [`${resource.id}: ${resource.title}`, `type=${resource.sourceType}`];

  if (resource.url) {
    parts.push(`url=${resource.url}`);
  }
  if (resource.publishedAt) {
    parts.push(`published=${resource.publishedAt}`);
  }
  if (resource.author) {
    parts.push(`author=${resource.author}`);
  }

  return parts.join(" | ");
}

export function formatResearchSynthesis(synthesis: ResearchSynthesis): string {
  const parts = [
    `${synthesis.id}: ${synthesis.title}`,
    `phase=${synthesis.phase}`,
    `confidence=${synthesis.confidence}`,
  ];

  if (synthesis.openQuestions.length) {
    parts.push(`openQuestions=${synthesis.openQuestions.length}`);
  }
  if (synthesis.nextSteps.length) {
    parts.push(`nextSteps=${synthesis.nextSteps.length}`);
  }

  return parts.join(" | ");
}
