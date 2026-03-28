export type MemoryStatus = "active" | "archived";
export type MemoryImportance = "low" | "medium" | "high";
export interface MemoryObservation {
    id: string;
    body: string;
    createdAt: string;
}
export interface Memory {
    id: string;
    summary: string;
    details?: string;
    topic?: string;
    tags: string[];
    importance: MemoryImportance;
    pinned: boolean;
    status: MemoryStatus;
    observations: MemoryObservation[];
    createdAt: string;
    updatedAt: string;
    lastRecalledAt?: string;
    archivedAt?: string;
}
export interface MemoryStoreFile {
    version: 1;
    memories: Memory[];
}
export interface MemoryPluginConfig {
    storagePath?: string;
    defaultTopic?: string;
}
export interface RememberMemoryInput {
    summary: string;
    details?: string;
    topic?: string;
    tags?: string[];
    importance?: MemoryImportance;
    pinned?: boolean;
}
export interface RecallMemoriesInput {
    search?: string;
    topic?: string;
    tag?: string;
    importance?: MemoryImportance;
    pinned?: boolean;
    includeArchived?: boolean;
    limit?: number;
}
export interface UpdateMemoryInput {
    memoryId: string;
    summary?: string;
    details?: string | null;
    topic?: string | null;
    tags?: string[];
    addTags?: string[];
    removeTags?: string[];
    importance?: MemoryImportance;
    pinned?: boolean;
}
export interface ReinforceMemoryInput {
    memoryId: string;
    body: string;
}
export interface DeleteMemoryInput {
    memoryId: string;
    hardDelete?: boolean;
}
