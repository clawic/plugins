import type { DeleteMemoryInput, Memory, MemoryPluginConfig, MemoryStoreFile, RecallMemoriesInput, ReinforceMemoryInput, RememberMemoryInput, UpdateMemoryInput } from "./types.js";
export declare class MemoryStore {
    private readonly storagePath;
    private readonly config;
    constructor(config?: MemoryPluginConfig);
    remember(input: RememberMemoryInput): Promise<Memory>;
    recall(input?: RecallMemoriesInput): Promise<Memory[]>;
    getMemory(memoryId: string): Promise<Memory>;
    updateMemory(input: UpdateMemoryInput): Promise<Memory>;
    reinforce(input: ReinforceMemoryInput): Promise<Memory>;
    deleteMemory(input: DeleteMemoryInput): Promise<{
        memoryId: string;
        deleted: "archived" | "removed";
    }>;
    inspectRaw(): Promise<MemoryStoreFile>;
    private load;
    private save;
}
