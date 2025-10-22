import pgdb from '../../../../server/db/PGDB.js';
import { TreeNode, UserProfileCompact } from '../../../../common/types/CommonTypes.js';
import { getFilenameExtension } from '../../../../common/CommonUtils.js';
import { convertToTreeNode, getContentType, isBinaryFile, normalizePath, parsePath, pathJoin, validPath } from './vfs-utils.js';

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

        // Throw an error if 'userProfile.name' is not valid.
        if (!/^[a-zA-Z0-9_]+$/.test(userProfile.name!)) {
            throw new Error(`Invalid user name: ${userProfile.name}. Only alphanumeric characters and underscores are allowed.`);
        }

        if (!userProfile.id) {
            throw new Error(`User profile must have an ID to create a folder. User: ${JSON.stringify(userProfile)}`);
        }

        // Check if user's root folder already exists
        const folderName = `rt_${userProfile.id}`;
        const existingFolder = await pgdb.query(
            'SELECT * FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3',
            rootKey, "", folderName
        );

        if (existingFolder.rows.length > 0) {
            console.log(`User folder ${folderName} already exists, skipping creation`);
            return;
        }

        // Using user's ID to build their root folder, since all users are part of a single tree.
        // Pass null for ordinal to let vfs_mkdir calculate the next available ordinal automatically
        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7)',
            userProfile.id, "", folderName, rootKey, null, false, false
        );
    }

    async getNodeByName(fullPath: string): Promise<TreeNode | null> {
        try {
            const relativePath = normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return {is_directory: true} as TreeNode; // Root directory has no database row
            }
            
            const { parentPath, filename } = parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            // Return the first row if found, null if no rows returned
            return result.rows.length > 0 ? convertToTreeNode(result.rows[0]) : null;
        } catch (error) {
            console.error('VFS2.getNodeByName error:', error);
            return null;
        }
    }

    // File existence and metadata
    async exists(fullPath: string, info: any=null): Promise<boolean> {
        // if a non-info object was passed the caller needs additional info so we run getNodeByName
        // which returns the whole record.
        fullPath = normalizePath(fullPath);

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
            const relativePath = normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return true;
            }
            
            const { parentPath, filename } = parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT vfs_exists($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            return result.rows[0].vfs_exists;
        } catch (error) {
            console.error('VFS2.exists error:', error);
            return false;
        }
    }
    
    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        try {
            const relativePath = normalizePath(path);
            
            // Special case for root directory
            if (relativePath === '') {
                return true;
            }
            const result = await pgdb.query(
                'SELECT vfs_children_exist($1, $2, $3)',
                owner_id, relativePath, rootKey
            );
            
            return result.rows[0].vfs_children_exist;
        } catch (error) {
            console.error('VFS2.children_exist error:', error);
            return false;
        }
    }
    
    async stat(fullPath: string): Promise<VFS2Stats> { 
        try {
            const relativePath = normalizePath(fullPath);
            
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
            
            const { parentPath, filename } = parsePath(relativePath);
            const result = await pgdb.query(
                'SELECT * FROM vfs_get_node_by_name($1, $2, $3)',
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
            const { parentPath, filename } = parsePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs_read_file($1, $2, $3, $4)',
                owner_id, parentPath, filename, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            const content = result.rows[0].vfs_read_file;
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
    
    async writeFileEx(owner_id: number, fullPath: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = normalizePath(fullPath);
            const { parentPath, filename } = parsePath(relativePath);
            
            // Pass null for ordinal if not provided to let the SQL function calculate it automatically
            const finalOrdinal = ordinal ?? null;
            
            // Determine if this is a binary file based on extension
            const ext = getFilenameExtension(filename).toLowerCase();
            const isBinary = isBinaryFile(ext);
            
            // Determine content type based on file extension
            const contentType = getContentType(ext);
            
            if (isBinary || Buffer.isBuffer(data)) {
                // Handle binary files
                let content: Buffer;
                if (typeof data === 'string') {
                    content = Buffer.from(data, encoding || 'utf8');
                } else {
                    content = data;
                }
                
                await pgdb.query(
                    'SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    owner_id, parentPath, filename, content, rootKey, finalOrdinal, contentType, is_public
                );
            } else {
                // Handle text files
                let textContent: string;
                if (typeof data === 'string') {
                    textContent = data;
                } else {
                    // data is Buffer - explicitly cast to ensure TypeScript knows it has toString method
                    textContent = (data as Buffer).toString(encoding || 'utf8');
                }
                
                await pgdb.query(
                    'SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    owner_id, parentPath, filename, textContent, rootKey, finalOrdinal, contentType, is_public
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
            const result = await pgdb.query(
                'SELECT * FROM vfs_nodes WHERE uuid = $1 AND doc_root_key = $2',
                uuid, rootKey
            );
            
            if (result.rows.length === 0) {
                return { node: null, docPath: '' };
            }
            
            const row = result.rows[0];
            const node = convertToTreeNode(row);
            
            // Construct the docPath from parent_path and filename
            let docPath: string;
            if (row.parent_path === '' || row.parent_path === '/') {
                // If parent_path is empty or root, docPath is just the filename
                docPath = row.filename;
            } else {
                // Combine parent_path and filename with proper path separator
                docPath = pathJoin(row.parent_path, row.filename);
            }
            
            return { node, docPath };
        } catch (error) {
            console.error('VFS2.getItemByID error:', error);
            return { node: null, docPath: '' };
        }
    }
    
    async readdir(owner_id: number, fullPath: string): Promise<string[]> {
        try {
            const relativePath = normalizePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3, $4)',
                owner_id, relativePath, rootKey, false
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
            const relativePath = normalizePath(fullPath);
            
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3, $4)',
                owner_id, relativePath, rootKey, loadContent
            );
            
            const treeNodes = rootContents.rows.map((row: any) => {
                return convertToTreeNode(row);
            });
            return treeNodes;
        } catch (error) {
            console.error('VFS2.readdirEx error:', error);
            throw error;
        }
    }
        
    async mkdirEx(owner_id: number, fullPath: string, options?: { recursive?: boolean }, is_public?: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = normalizePath(fullPath);
            const { parentPath, filename } = parsePath(relativePath);
            
            // Pass null for ordinal if not provided to let the SQL function calculate it automatically
            const finalOrdinal = ordinal ?? null;
            
            await pgdb.query(
                'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7)',
                owner_id, parentPath, filename, rootKey, finalOrdinal, options?.recursive || false, is_public || false
            );
        } catch (error) {
            console.error('VFS2.mkdirEx error:', error);
            throw error;
        }
    } 
    
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        if (!validPath(newPath)) {
            throw new Error(`Invalid new path: ${newPath}. Only alphanumeric characters and underscores`);
        }
        
        const { parentPath: oldParentPath, filename: oldFilename } = parsePath(oldPath);
        const { parentPath: newParentPath, filename: newFilename } = parsePath(newPath);
            
        const result = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            owner_id, oldParentPath, oldFilename, newParentPath, newFilename, rootKey
        );
            
        // If the operation wasn't successful, throw an error with the diagnostic message
        if (!result.rows[0].success) {
            throw new Error(`Failed to rename: ${result.rows[0].diagnostic}`);
        }
    }
    
    async unlink(owner_id: number, fullPath: string): Promise<void> {
        try {
            const relativePath = normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot unlink root directory');
            }
            
            const { parentPath, filename } = parsePath(relativePath);
            
            // Check if the file exists and get its info
            let stats: VFS2Stats;
            try {
                stats = await this.stat(fullPath);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            // unlink should only work on files, not directories
            if (stats.is_directory) {
                throw new Error(`Cannot unlink directory: ${fullPath}. Use rm with recursive option instead.`);
            }
            
            // Delete the file using direct DELETE query
            const result = await pgdb.query(
                'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND is_directory = false AND (owner_id = $4 OR $4 = 0) RETURNING *',
                rootKey, parentPath, filename, owner_id
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
            const relativePath = normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot delete root directory');
            }
            
            const { parentPath, filename } = parsePath(relativePath);
            
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
                
                // Use a direct DELETE query for now since vfs_rmdir doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, owner_id
                );
                
                if (result.rowCount === 0) {
                    throw new Error(`Permission denied or directory not found: ${fullPath}`);
                }
                
                // If recursive, also delete all children
                if (options?.recursive) {
                    const childPath = relativePath;
                    await pgdb.query(
                        'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3) AND (owner_id = $4 OR $4 = 0)',
                        rootKey, childPath, childPath + '/%', owner_id
                    );
                }
            } else {
                // For files, use direct DELETE query since vfs_unlink doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, owner_id
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
            const relativePath = normalizePath(parentPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_shift_ordinals_down($1, $2, $3, $4, $5)',
                owner_id, relativePath, rootKey, insertOrdinal, slotsToAdd
            );
            
            // Create path mapping for compatibility with existing code
            // In VFS2, filenames don't change (only ordinals do), so old and new filenames are the same
            const pathMapping = new Map<string, string>();
            
            for (const row of result.rows) {
                // Since filenames don't change in VFS2, we map each filename to itself
                const filename = row.old_filename;
                pathMapping.set(filename, filename);
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
                'UPDATE vfs_nodes SET ordinal = $1 WHERE uuid = $2 AND doc_root_key = $3 RETURNING *',
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
    
    /**
     * Swap the ordinal values of two files/folders in a single atomic operation
     * This safely handles the unique constraint on (doc_root_key, parent_path, ordinal)
     * @param uuid1 - The UUID of the first file/folder
     * @param uuid2 - The UUID of the second file/folder
     * @returns Object containing the UUIDs and their new ordinal values
     */
    async swapOrdinals(uuid1: string, uuid2: string): Promise<{ uuid1: string; ordinal1: number; uuid2: string; ordinal2: number }> {
        try {
            const result = await pgdb.query(
                'SELECT * FROM vfs_swap_ordinals($1, $2, $3)',
                uuid1, uuid2, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`Failed to swap ordinals for UUIDs ${uuid1} and ${uuid2}`);
            }
            
            const row = result.rows[0];
            console.log(`Swapped ordinals: ${uuid1} (${row.ordinal1}) <-> ${uuid2} (${row.ordinal2})`);
            
            return {
                uuid1: row.uuid1,
                ordinal1: row.ordinal1,
                uuid2: row.uuid2,
                ordinal2: row.ordinal2
            };
        } catch (error) {
            console.error('VFS2.swapOrdinals error:', error);
            throw error;
        }
    }
}

const vfs2 = new VFS2();
export default vfs2;