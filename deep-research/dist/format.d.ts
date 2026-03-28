import type { Research, ResearchResource, ResearchSynthesis } from "./types.js";
export declare function formatResearch(research: Research, activeResearchId?: string): string;
export declare function formatResearchList(label: string, researches: Research[], activeResearchId?: string): string;
export declare function formatResearchDetail(research: Research, activeResearchId?: string): string;
export declare function formatResearchResource(resource: ResearchResource): string;
export declare function formatResearchSynthesis(synthesis: ResearchSynthesis): string;
