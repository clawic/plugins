export type ResearchStatus = "active" | "paused" | "completed" | "archived";
export type ResearchPhase = "framing" | "collection" | "analysis" | "synthesis" | "reporting";
export type ResearchSourceType =
  | "web"
  | "paper"
  | "document"
  | "dataset"
  | "interview"
  | "note"
  | "other";
export type ResearchConfidence = "low" | "medium" | "high";

export interface ResearchResource {
  id: string;
  title: string;
  url?: string;
  sourceType: ResearchSourceType;
  summary?: string;
  notes?: string;
  author?: string;
  publishedAt?: string;
  capturedAt: string;
}

export interface ResearchSynthesis {
  id: string;
  phase: ResearchPhase;
  title: string;
  body: string;
  confidence: ResearchConfidence;
  openQuestions: string[];
  nextSteps: string[];
  createdAt: string;
}

export interface Research {
  id: string;
  title: string;
  question: string;
  objective?: string;
  scope?: string;
  tags: string[];
  status: ResearchStatus;
  phase: ResearchPhase;
  resources: ResearchResource[];
  syntheses: ResearchSynthesis[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface DeepResearchStoreFile {
  version: 1;
  activeResearchId?: string;
  researches: Research[];
}

export interface DeepResearchPluginConfig {
  storagePath?: string;
}

export interface CreateResearchInput {
  title: string;
  question: string;
  objective?: string;
  scope?: string;
  tags?: string[];
  phase?: ResearchPhase;
  setActive?: boolean;
}

export interface ListResearchInput {
  search?: string;
  status?: ResearchStatus;
  phase?: ResearchPhase;
  tag?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface UpdateResearchInput {
  researchId: string;
  title?: string;
  question?: string;
  objective?: string | null;
  scope?: string | null;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  phase?: ResearchPhase;
  status?: ResearchStatus;
}

export interface AddResourceInput {
  researchId?: string;
  title: string;
  url?: string;
  sourceType?: ResearchSourceType;
  summary?: string;
  notes?: string;
  author?: string;
  publishedAt?: string;
}

export interface AddSynthesisInput {
  researchId?: string;
  phase?: ResearchPhase;
  title: string;
  body: string;
  confidence?: ResearchConfidence;
  openQuestions?: string[];
  nextSteps?: string[];
}
