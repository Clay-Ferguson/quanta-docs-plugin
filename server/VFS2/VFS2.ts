/* eslint-disable */
// @ts-nocheck
import pgdb from '../../../../server/db/PGDB.js';
import { config } from '../../../../server/Config.js';
import { TreeNode, UserProfileCompact } from '../../../../common/types/CommonTypes.js';
import { svrUtil } from '../../../../server/ServerUtil.js';
import { getFilenameExtension } from '../../../../common/CommonUtils.js';

const rootKey = "usr"; // Default root key for VFS2, can be changed based on configuration

export interface VFS2Stats {
    is_public?: boolean;
    is_directory: boolean;
    birthtime: Date;
    mtime: Date;
    size: number;
}

/**
 * Virtual File System 2 (VFS2) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS2 {
        /* Ensures that this user has a folder in the VFS root directory, and that it's named after their username. */
    async createUserFolder(userProfile: UserProfileCompact) {
        console.log(`Creating user folder for: ${userProfile.name} (ID: ${userProfile.id})`);
        const rootKey = "usr";

        // Throw an error if 'userProfile.name' is not a valid filename.
        if (!/^[a-zA-Z0-9_]+$/.test(userProfile.name!)) {
            throw new Error(`Invalid user name: ${userProfile.name}. Only alphanumeric characters and underscores are allowed.`);
        }

        if (!userProfile.id) {
            throw new Error(`User profile must have an ID to create a folder. User: ${JSON.stringify(userProfile)}`);
        }
        const existingNodes = await this.readdirEx(userProfile.id, "", false);
        if (existingNodes && existingNodes.length > 0) {
            const node = existingNodes[0];
            const ordinalPrefix = node.name.split('_')[0]; // Get the ordinal prefix from the first node
            // Get the substring to the right of the "_" in node.name
            const nameSuffix = node.name.split('_').slice(1).join('_'); // Join the rest of the name after the ordinal prefix
            if (nameSuffix === userProfile.name) {
                console.log(`User folder already exists with the correct name: ${node.name}`);
                return; // User folder already exists with the correct name
            }

            const newFolderName = `${ordinalPrefix}_${userProfile.name}`;
            console.log(`Renaming existing user folder to: ${newFolderName}`);
            await this.rename(userProfile.id, existingNodes[0].name, newFolderName);
            return;
        }

        // Check for already existing user folder
        // const docPath = await docSvc.resolveNonOrdinalPath(0, rootKey, userProfile.name, this);
        // if (docPath) {
        //     console.log(`Resolved docPath: ${docPath}`);
        //     if (await this.exists(docPath)) {
        //         console.log(`User folder already exists: ${docPath}`);
        //         return; 
        //     }
        // }

        // Get the next available ordinal (max + 1) for the root directory
        const maxOrdinalResult = await pgdb.query(
            'SELECT COALESCE(MAX(ordinal), -1) + 1 as next_ordinal FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2',
            rootKey, ""
        );
        const maxOrdinal = maxOrdinalResult.rows[0].next_ordinal;
        const maxOrdinalStr = maxOrdinal.toString().padStart(4, '0');

        await pgdb.query(
            'SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7)',
            userProfile.id, "", `${maxOrdinalStr}_${userProfile.name}`, rootKey, maxOrdinal, false, false
        );
    }

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
            ordinal: row.ordinal,  // Add the ordinal field from database
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
    
    async stat(fullPath: string): Promise<VFS2Stats> { 
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
                } as VFS2Stats;
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
            } as VFS2Stats;
        } catch (error) {
            console.error('VFS2.stat error:', error);
            throw error;
        }
    }
    
    async readFile(owner_id: number, fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs2_read_file($1, $2, $3, $4)',
                pgdb.authId(owner_id), parentPath, filename, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            const content = result.rows[0].vfs2_read_file;
            if (encoding) {
                return content.toString(encoding);
            } else {
                return content;
            }
        } catch (error) {
            console.error('VFS2.readFile error:', error);
            throw error;
        }
    }
    
    async writeFile(owner_id: number, fullPath: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        return await this.writeFileEx(owner_id, fullPath, data, encoding || 'utf8', false);
    }
    
    
    /**
     * Determine if a file is binary based on its extension
     */
    private isBinaryFile(ext: string): boolean {
        const binaryExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.tiff', '.webp',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.tar', '.gz', '.rar', '.7z',
            '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
            '.exe', '.dll', '.so', '.dylib',
            '.woff', '.woff2', '.ttf', '.otf'
        ];
        
        return binaryExtensions.includes(ext.toLowerCase());
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(ext: string): string {
        switch (ext.toLowerCase()) {
        case '.md':
            return 'text/markdown';
        case '.txt':
            return 'text/plain';
        case '.json':
            return 'application/json';
        case '.html':
        case '.htm':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.ts':
            return 'text/typescript';
        case '.xml':
            return 'application/xml';
        case '.yaml':
        case '.yml':
            return 'application/yaml';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.pdf':
            return 'application/pdf';
        case '.zip':
            return 'application/zip';
        case '.mp3':
            return 'audio/mpeg';
        case '.mp4':
            return 'video/mp4';
        default:
            return 'application/octet-stream';
        }
    }
    
    async writeFileEx(owner_id: number, fullPath: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = this.normalizePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // If ordinal is not provided, get the next available ordinal (max + 1)
            let finalOrdinal = ordinal;
            if (finalOrdinal === undefined) {
                const maxOrdinalResult = await pgdb.query(
                    'SELECT COALESCE(MAX(ordinal), -1) + 1 as next_ordinal FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2',
                    rootKey, parentPath
                );
                finalOrdinal = maxOrdinalResult.rows[0].next_ordinal;
            }
            
            // Determine if this is a binary file based on extension
            const ext = getFilenameExtension(filename).toLowerCase();
            const isBinary = this.isBinaryFile(ext);
            
            // Determine content type based on file extension
            const contentType = this.getContentType(ext);
            
            if (isBinary || Buffer.isBuffer(data)) {
                // Handle binary files
                let content: Buffer;
                if (typeof data === 'string') {
                    content = Buffer.from(data, encoding || 'utf8');
                } else {
                    content = data;
                }
                
                await pgdb.query(
                    'SELECT vfs2_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    pgdb.authId(owner_id), parentPath, filename, content, rootKey, finalOrdinal, contentType, is_public
                );
            } else {
                // Handle text files
                let textContent: string;
                if (typeof data === 'string') {
                    textContent = data;
                } else {
                    textContent = data.toString(encoding || 'utf8');
                }
                
                await pgdb.query(
                    'SELECT vfs2_write_text_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    pgdb.authId(owner_id), parentPath, filename, textContent, rootKey, finalOrdinal, contentType, is_public
                );
            }
        } catch (error) {
            console.error('VFS2.writeFileEx error:', error);
            throw error;
        }
    }
    
    /**
     * Get a node by its UUID and return the TreeNode with constructed docPath
     * @param uuid - The UUID of the node to retrieve
     * @param rootKey - The root key for the VFS2 (defaults to "usr")
     * @returns The TreeNode with docPath constructed from parent_path and filename, or null if not found
     */
    async getItemByID(uuid: string, rootKey: string = "usr"): Promise<{ node: TreeNode | null; docPath: string }> {
        try {
            // todo-0: does vfs2_nodes have 'rootKey' column? If so it's deprecated. Remove it.
            const result = await pgdb.query(
                'SELECT * FROM vfs2_nodes WHERE uuid = $1 AND doc_root_key = $2',
                uuid, rootKey
            );
            
            if (result.rows.length === 0) {
                return { node: null, docPath: '' };
            }
            
            const row = result.rows[0];
            const node = this.convertToTreeNode(row);
            
            // Construct the docPath from parent_path and filename
            let docPath: string;
            if (row.parent_path === '' || row.parent_path === '/') {
                // If parent_path is empty or root, docPath is just the filename
                docPath = row.filename;
            } else {
                // Combine parent_path and filename with proper path separator
                docPath = this.pathJoin(row.parent_path, row.filename);
            }
            
            return { node, docPath };
        } catch (error) {
            console.error('VFS2.getItemByID error:', error);
            return { node: null, docPath: '' };
        }
    }
    
    async readdir(owner_id: number, fullPath: string): Promise<string[]> {
        try {
            const relativePath = this.normalizePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs2_readdir($1, $2, $3, $4)',
                pgdb.authId(owner_id), relativePath, rootKey, false
            );
            
            // Extract just the filenames from the result
            return result.rows.map((row: any) => row.filename);
        } catch (error) {
            console.error('VFS2.readdir error:', error);
            throw error;
        }
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
    
    async mkdirEx(owner_id: number, fullPath: string, options?: { recursive?: boolean }, is_public?: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = this.normalizePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // If ordinal is not provided, get the next available ordinal (max + 1)
            let finalOrdinal = ordinal;
            if (finalOrdinal === undefined) {
                const maxOrdinalResult = await pgdb.query(
                    'SELECT COALESCE(MAX(ordinal), -1) + 1 as next_ordinal FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2',
                    rootKey, parentPath
                );
                finalOrdinal = maxOrdinalResult.rows[0].next_ordinal;
            }
            
            await pgdb.query(
                'SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7)',
                pgdb.authId(owner_id), parentPath, filename, rootKey, finalOrdinal, options?.recursive || false, is_public || false
            );
        } catch (error) {
            console.error('VFS2.mkdirEx error:', error);
            throw error;
        }
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
        try {
            const relativePath = this.normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot unlink root directory');
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // Check if the file exists and get its info
            let stats: VFS2Stats;
            try {
                stats = await this.stat(fullPath);
            } catch (error) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            // unlink should only work on files, not directories
            if (stats.is_directory) {
                throw new Error(`Cannot unlink directory: ${fullPath}. Use rm with recursive option instead.`);
            }
            
            // Delete the file using direct DELETE query
            const result = await pgdb.query(
                'DELETE FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND is_directory = false AND (owner_id = $4 OR $4 = 0) RETURNING *',
                rootKey, parentPath, filename, pgdb.authId(owner_id)
            );
            
            if (result.rowCount === 0) {
                throw new Error(`Permission denied or file not found: ${fullPath}`);
            }
        } catch (error) {
            console.error('VFS2.unlink error:', error);
            throw error;
        }
    }
    
    async rm(owner_id: number, fullPath: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        try {
            const relativePath = this.normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot delete root directory');
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // Check if the file/directory exists and get its info
            let stats: VFS2Stats;
            try {
                stats = await this.stat(fullPath);
            } catch (error) {
                // If force option is enabled, don't throw errors for non-existent files/directories
                if (options?.force) {
                    return;
                }
                throw error;
            }
            
            if (stats.is_directory) {
                // For directories, check if they have children (unless recursive is enabled)
                if (!options?.recursive) {
                    const hasChildren = await this.childrenExist(owner_id, relativePath);
                    if (hasChildren) {
                        throw new Error(`Directory not empty: ${fullPath}. Use recursive option to delete non-empty directories.`);
                    }
                }
                
                // Use a direct DELETE query for now since vfs2_rmdir doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, pgdb.authId(owner_id)
                );
                
                if (result.rowCount === 0) {
                    throw new Error(`Permission denied or directory not found: ${fullPath}`);
                }
                
                // If recursive, also delete all children
                if (options?.recursive) {
                    const childPath = relativePath;
                    await pgdb.query(
                        'DELETE FROM vfs2_nodes WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3) AND (owner_id = $4 OR $4 = 0)',
                        rootKey, childPath, childPath + '/%', pgdb.authId(owner_id)
                    );
                }
            } else {
                // For files, use direct DELETE query since vfs2_unlink doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs2_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, pgdb.authId(owner_id)
                );
                
                if (result.rowCount === 0) {
                    throw new Error(`Permission denied or file not found: ${fullPath}`);
                }
            }
        } catch (error) {
            // If force option is enabled, don't throw errors for certain types of failures
            if (options?.force && error instanceof Error && 
                (error.message.includes('not found') || error.message.includes('File not found'))) {
                return;
            }
            console.error('VFS2.rm error:', error);
            throw error;
        }
    }
    
    /**
     * Shifts ordinals down for all files/folders at or above a given ordinal position
     * This creates space for new files to be inserted at specific positions by
     * incrementing the ordinal values directly in the database.
     * 
     * @param owner_id - The owner ID for authorization
     * @param parentPath - The absolute path to the directory containing items to shift
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and above get shifted)
     * @param slotsToAdd - Number of ordinal slots to add (shift amount)
     * @returns Map of old relative paths to new relative paths (filenames don't change in VFS2, so they map to themselves)
     */
    async shiftOrdinalsDown(owner_id: number, parentPath: string, insertOrdinal: number, slotsToAdd: number): Promise<Map<string, string>> {
        try {
            const relativePath = this.normalizePath(parentPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs2_shift_ordinals_down($1, $2, $3, $4, $5)',
                pgdb.authId(owner_id), relativePath, rootKey, insertOrdinal, slotsToAdd
            );
            
            // Create path mapping for compatibility with existing code
            // In VFS2, filenames don't change (only ordinals do), so old and new filenames are the same
            const pathMapping = new Map<string, string>();
            
            for (const row of result.rows) {
                // Since filenames don't change in VFS2, we map each filename to itself
                const filename = row.old_filename;
                pathMapping.set(filename, filename);
                
                console.log(`Shifted ordinal for ${filename}: ${row.old_ordinal} -> ${row.new_ordinal}`);
            }
            
            return pathMapping;
        } catch (error) {
            console.error('VFS2.shiftOrdinalsDown error:', error);
            throw error;
        }
    }
    
    /**
     * Set the ordinal value for a file/folder record
     * @param uuid - The UUID of the file/folder to update
     * @param ordinal - The new ordinal value to set
     */
    async setOrdinal(uuid: string, ordinal: number): Promise<void> {
        try {
            const result = await pgdb.query(
                'UPDATE vfs2_nodes SET ordinal = $1 WHERE uuid = $2 AND doc_root_key = $3 RETURNING *',
                ordinal, uuid, rootKey
            );
            
            if (result.rowCount === 0) {
                throw new Error(`File/folder with UUID ${uuid} not found`);
            }
            
            console.log(`Set ordinal for UUID ${uuid} to ${ordinal}`);
        } catch (error) {
            console.error('VFS2.setOrdinal error:', error);
            throw error;
        }
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