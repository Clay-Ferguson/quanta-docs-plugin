import { TreeNode } from "../../../common/types/CommonTypes.js";

// todo-0: this is probably no longer needed since we only support VFS now
export interface IFSStats {
    is_public?: boolean;
    is_directory: boolean;
    birthtime: Date;
    mtime: Date;
    size: number;
}

/**
 * Virtual File System Interface
 * todo-0: this is probably no longer needed since we only support VFS now?
 */
export interface IFS {
    // File existence and metadata
    exists(path: string, info?: any): Promise<boolean>;
    childrenExist(owner_id: number, path: string): Promise<boolean>;

    stat(path: string): Promise<IFSStats>; 

    // File content operations
    readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    writeFile(owner_id: number, path: string, data: string | Buffer, encoding: BufferEncoding): Promise<void>;
    writeFileEx(owner_id: number, path: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean, ordinal?: number): Promise<void>;

    getItemByID(uuid: string, rootKey: string): Promise<{ node: TreeNode | null; docPath: string }>;

    // Directory operations
    readdir(owner_id: number, path: string): Promise<string[]>;
    readdirEx(owner_id: number, fullPath: string, loadContent: boolean): Promise<TreeNode[]>;
    mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void>;
    mkdirEx(owner_id: number, path: string, options?: { recursive?: boolean }, is_public?: boolean, ordinal?: number): Promise<void>;

    // File/directory manipulation
    rename(owner_id: number, oldPath: string, newPath: string): Promise<void>;
    unlink(owner_id: number, path: string): Promise<void>;
    rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;

    // Ordinal management
    setOrdinal(uuid: string, ordinal: number): Promise<void>;
    shiftOrdinalsDown(owner_id: number, parentPath: string, insertOrdinal: number, slotsToAdd: number): Promise<Map<string, string>>;

    pathJoin(...parts: string[]): string;
    normalizePath(fullPath: string): string;
}