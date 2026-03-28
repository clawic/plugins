import type { AddResourceInput, AddSynthesisInput, CreateResearchInput, DeepResearchPluginConfig, DeepResearchStoreFile, ListResearchInput, Research, ResearchResource, ResearchSynthesis, UpdateResearchInput } from "./types.js";
export declare class DeepResearchStore {
    private readonly storagePath;
    constructor(config?: DeepResearchPluginConfig);
    createResearch(input: CreateResearchInput): Promise<Research>;
    listResearch(input?: ListResearchInput): Promise<Research[]>;
    getResearch(researchId?: string): Promise<Research>;
    getActiveResearchId(): Promise<string | undefined>;
    updateResearch(input: UpdateResearchInput): Promise<Research>;
    focusResearch(researchId: string): Promise<Research>;
    addResource(input: AddResourceInput): Promise<{
        research: Research;
        resource: ResearchResource;
    }>;
    addSynthesis(input: AddSynthesisInput): Promise<{
        research: Research;
        synthesis: ResearchSynthesis;
    }>;
    inspectRaw(): Promise<DeepResearchStoreFile>;
    private load;
    private save;
}
