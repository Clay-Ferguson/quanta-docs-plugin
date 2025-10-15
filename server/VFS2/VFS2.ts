/* eslint-disable */
// @ts-nocheck
import { IFS, IFSStats } from '../../../../plugins/docs/server/IFS.js'
import pgdb from '../../../../server/db/PGDB.js';
import { config } from '../../../../server/Config.js';
import { TreeNode, UserProfileCompact } from '../../../../common/types/CommonTypes.js';
import { svrUtil } from '../../../../server/ServerUtil.js';
import { getFilenameExtension } from '../../../../common/CommonUtils.js';

const rootKey = "usr"; // Default root key for VFS2, can be changed based on configuration

/**
 * Virtual File System 2 (VFS2) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS2 implements IFS {
    // Methods will be added one by one under guidance
    
    /**
     * Parse a full path to extract parent path and filename
     * @param fullPath - The full absolute path 
     * @returns Object with parentPath and filename
     */
    private parsePath(fullPath: string): { parentPath: string; filename: string } {
        const normalizedPath = this.normalizePath(fullPath);

        // Split the path into parent directory and filename, using string functions, by finding the last slash
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        let parentPath: string;
        let filename: string;
        if (lastSlashIndex === -1) {
            // No slashes found, this is just a filename
            parentPath = '';
            filename = normalizedPath;
        } else {
            // Split into parent path and filename
            parentPath = normalizedPath.slice(0, lastSlashIndex);
            filename = normalizedPath.slice(lastSlashIndex + 1);
        }
        
        return { parentPath, filename };
    }

    convertToTreeNode(row: any): TreeNode | null {
        if (!row) {
            return null; // No row found, return null
        }
        // Convert PostgreSQL row to TreeNode format
        return {
            uuid: row.uuid,  // Add the UUID field
            owner_id: row.owner_id,
            is_public: row.is_public,
            is_directory: row.is_directory,
            name: row.filename, 
            createTime: row.created_time,
            modifyTime: row.modified_time,
            content: row.content_text,  // Fixed: was row.text_content, now row.content_text
        } as TreeNode;
    }

    async getNodeByName(fullPath: string): Promise<TreeNode | null> {
        try {
            const relativePath = this.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return {is_directory: true} as TreeNode; // Root directory has no database row
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs2_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            // Return the first row if found, null if no rows returned
            return result.rows.length > 0 ? this.convertToTreeNode(result.rows[0]) : null;
        } catch (error) {
            console.error('VFS2.getNodeByName error:', error);
            return null;
        }
    }

    // File existence and metadata
    async exists(fullPath: string, info: any=null): Promise<boolean> {
        // if a non-info object was passed the caller needs additional info so we run getNodeByName
        // which returns the whole record.
        fullPath = this.normalizePath(fullPath);

        if (info) {
            if (fullPath === '') {
                // Special case for root directory
                info.node = { is_directory: true, is_public: false, owner_id: pgdb.adminProfile!.id } as TreeNode; // Root directory has no database row
                return true; // Root directory always exists
            }
            const node: TreeNode | null = await this.getNodeByName(fullPath);
            if (node) {
                info.node = node; // Attach the node to the info object
                return true; // File exists
            }
            return false; // File does not exist
        }

        try {
            const relativePath = this.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return true;
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT vfs2_exists($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            return result.rows[0].vfs2_exists;
        } catch (error) {
            console.error('VFS2.exists error:', error);
            return false;
        }
    }
    
    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        try {
            const relativePath = this.normalizePath(path);
            
            // Special case for root directory
            if (relativePath === '') {
                return true;
            }
            const result = await pgdb.query(
                'SELECT vfs2_children_exist($1, $2, $3)',
                pgdb.authId(owner_id), relativePath, rootKey
            );
            
            return result.rows[0].vfs2_children_exist;
        } catch (error) {
            console.error('VFS2.children_exist error:', error);
            return false;
        }
    }
    
    async stat(fullPath: string): Promise<IFSStats> { 
        try {
            const relativePath = this.normalizePath(fullPath);
            
            // Special case for root directory
            if (relativePath === '') {
                // Return mock stats for root directory
                return {
                    // Root is considered owned by admin and not public.
                    is_public: false,
                    is_directory: true,
                    birthtime: new Date(),
                    mtime: new Date(),
                    size: 0
                } as IFSStats;
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            const result = await pgdb.query(
                'SELECT * FROM vfs2_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            const row = result.rows[0];
            return {
                is_public: row.is_public,
                is_directory: row.is_directory,
                birthtime: new Date(row.created_time),
                mtime: new Date(row.modified_time),
                size: row.size_bytes || 0
            } as IFSStats;
        } catch (error) {
            console.error('VFS2.stat error:', error);
            throw error;
        }
    }
    
    async readFile(owner_id: number, fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        throw new Error("Method not implemented yet");
    }
    
    async writeFile(owner_id: number, fullPath: string, data: string | Buffer, encoding: BufferEncoding): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    async writeFileEx(owner_id: number, fullPath: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    async getItemByID(uuid: string, rootKey: string): Promise<{ node: TreeNode | null; docPath: string }> {
        throw new Error("Method not implemented yet");
    }
    
    async readdir(owner_id: number, fullPath: string): Promise<string[]> {
        throw new Error("Method not implemented yet");
    }
    
    async readdirEx(owner_id: number, fullPath: string, loadContent: boolean): Promise<TreeNode[]> {
        try {
            const relativePath = this.normalizePath(fullPath);
            
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs2_readdir($1, $2, $3, $4)',
                pgdb.authId(owner_id), relativePath, rootKey, loadContent
            );
            
            const treeNodes = rootContents.rows.map((row: any) => {
                return this.convertToTreeNode(row);
            });
            return treeNodes;
        } catch (error) {
            console.error('VFS2.readdirEx error:', error);
            throw error;
        }
    }
    
    async mkdir(owner_id: number, fullPath: string, options?: { recursive?: boolean }): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    async mkdirEx(owner_id: number, fullPath: string, options?: { recursive?: boolean }, is_public?: boolean): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        if (!this.validPath(newPath)) {
            throw new Error(`Invalid new path: ${newPath}. Only alphanumeric characters and underscores`);
        }
        
        const { parentPath: oldParentPath, filename: oldFilename } = this.parsePath(oldPath);
        const { parentPath: newParentPath, filename: newFilename } = this.parsePath(newPath);
            
        const result = await pgdb.query(
            'SELECT * FROM vfs2_rename($1, $2, $3, $4, $5, $6)',
            pgdb.authId(owner_id), oldParentPath, oldFilename, newParentPath, newFilename, rootKey
        );
            
        // If the operation wasn't successful, throw an error with the diagnostic message
        if (!result.rows[0].success) {
            throw new Error(`Failed to rename: ${result.rows[0].diagnostic}`);
        }
    }
    
    async unlink(owner_id: number, fullPath: string): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    async rm(owner_id: number, fullPath: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        throw new Error("Method not implemented yet");
    }
    
    checkFileAccess(filename: string, root: string): void {
        // NOTE to AI: Do not try to implement this method, it is not needed for VFS2. It needs to remain a no-op.
    }
    
    pathJoin(...parts: string[]): string {
        return this.normalizePath(parts.join('/'));
    }
    
    // Split 'fullPath' by '/' and then run 'validName' on each part or if there's no '/' just run 'validName' on the fullPath
    public validPath(fullPath: string): boolean {
        // Normalize the path to ensure consistent formatting
        fullPath = this.normalizePath(fullPath);

        // Split the path by '/' and check each part
        const parts = fullPath.split('/');
        for (const part of parts) {
            if (!svrUtil.validName(part)) {
                return false; // If any part is invalid, return false
            }
        }
        return true; // All parts are valid
    }

    /* NOTE: VFS2 requires there be NO leading slashes on paths */
    public normalizePath(fullPath: string): string {
        // use regex to strip any leading slashes or dots
        const normalizedPath = 
            // strip any leading slashes or dots
            fullPath.replace(/^[/.]+/, '')
                // replace multiple slashes with a single slash
                .replace(/\/+/g, '/')
                // final replacement to ensure no trailing slash
                .replace(/\/+$/, '');

        return normalizedPath;
    }
}

const vfs2 = new VFS2();
export default vfs2;