import { Request, Response } from 'express';
import path from 'path';
import { AuthenticatedRequest, handleError, svrUtil } from "../../../server/ServerUtil.js";
import { docUtil } from "./DocUtil.js";
import { runTrans } from '../../../server/db/Transactional.js';
import { fixName } from '../../../common/CommonUtils.js';
import { ANON_USER_ID, TreeNode } from '../../../common/types/CommonTypes.js';
import vfs2 from './VFS2/VFS2.js';
import { normalizePath } from './VFS2/vfs-utils.js';

/**
 * DocMod - Document Modification Service
 * 
 * This class provides comprehensive file and folder management operations for the document tree viewer feature.
 * It handles CRUD operations on files and folders within a secure, sandboxed environment with proper access controls.
 * 
 * Key Features:
 * - File operations: save, rename, delete, move up/down in order
 * - Folder operations: create, rename, delete, convert file to folder
 * - Batch operations: multi-file deletion, cut/paste with ordinal positioning
 * - Content manipulation: file splitting on delimiters, joining multiple files
 * - Ordinal management: maintains numeric prefixes for ordered file/folder display
 * 
 * Security:
 * - All file operations are validated against the configured document root
 * - Operations are limited to configured public folders only
 * 
 * File Naming Convention:
 * - Files and folders use numeric prefixes (e.g., "0001_filename.md")
 * - Ordinals are automatically managed when items are moved or inserted
 * - Supports automatic .md extension addition for files without extensions
 */
class DocMod {
    /**
     * Saves file content to the server for the tree viewer feature
     * 
     * This method handles both simple file saving and advanced content splitting functionality.
     * When the split option is enabled, content can be divided at '\n~\n' delimiters to create
     * multiple files with proper ordinal sequencing.
     * 
     * Features:
     * - Automatic .md extension addition for files without extensions
     * - File renaming support during save operation
     * - Content splitting on '\n~\n' delimiter with ordinal management
     * - Proper ordinal shifting for existing files when splitting
     * - Security validation for all file operations
     * 
     * @param req - Express request object containing:
     *   - filename: string - Name of the file to save
     *   - content: string - File content to save
     *   - treeFolder: string - Relative path to the target folder
     *   - newFileName?: string - Optional new name for the file (triggers rename)
     *   - split?: boolean - Whether to split content on '\n~\n' delimiter
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    saveFile = async (req: Request<any, any, { filename: string; content: string; treeFolder: string; newFileName?: string, split?: boolean }>, 
        res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            try {
                // Extract request parameters
                const { filename, content, treeFolder, split } = req.body;
                let { newFileName } = req.body;

                if (!svrUtil.validName(filename)) {
                    res.status(400).json({ error: 'Invalid filename' });
                    return;
                }
    
                // Ensure new filenames have proper .md extension if not specified
                if (newFileName && !path.extname(newFileName)) {
                    newFileName += '.md';
                }
    
                // Validate document root configuration
                const root = "/";
    
                // Validate required parameters
                if (!filename || content === undefined || !treeFolder) {
                    res.status(400).json({ error: 'Filename, content, and treeFolder are required' });
                    return;
                }
    
                // Construct absolute paths for file operations
                const absoluteFolderPath = path.join(root, treeFolder);
                const absoluteFilePath = path.join(absoluteFolderPath, filename);
    
                // Verify target directory exists and is accessible
                if (!await vfs2.exists(absoluteFolderPath)) {
                    res.status(404).json({ error: 'Directory not found' });
                    return;
                }
    
                // Ensure the target path is actually a directory
                const stat = await vfs2.stat(absoluteFolderPath);
                if (!stat.is_directory) {
                    res.status(400).json({ error: 'Path is not a directory' });
                    return;
                }
    
                let finalFilePath = absoluteFilePath;
    
                // Handle file renaming if a new filename is provided
                if (newFileName && newFileName !== filename) {
                    const newAbsoluteFilePath = path.join(absoluteFolderPath, newFileName);
                    
                    // Verify the original file exists before attempting rename
                    if (await vfs2.exists(absoluteFilePath)) {
                        // Prevent overwriting existing files
                        if (await vfs2.exists(newAbsoluteFilePath)) {
                            res.status(409).json({ error: 'A file with the new name already exists' });
                            return;
                        }
                        
                        // Perform the file rename operation with security check
                        await vfs2.rename(owner_id, absoluteFilePath, newAbsoluteFilePath);
                        console.log(`File renamed successfully: ${absoluteFilePath} -> ${newAbsoluteFilePath}`);
                    }
                    
                    // Update the target file path for subsequent operations
                    finalFilePath = newAbsoluteFilePath;
                }
                
                if (split) {
                    // Content splitting mode: divide content on '\n~\n' delimiter
                    const parts = content.split('\n~\n');
                    
                    if (parts.length > 1) {
                        // Determine the file system type to handle ordinal extraction differently
                        let originalOrdinal: number;
                        
                        // VFS2: Get ordinal from database
                        const fileInfo: any = {};
                        if (await vfs2.exists(finalFilePath, fileInfo) && fileInfo.node) {
                            originalOrdinal = fileInfo.node.ordinal;
                        } else {
                            originalOrdinal = 0; // Default if file doesn't exist yet
                        }
                        
                        // Make room for new files by shifting existing ordinals down
                        // Subtract 1 because the original file keeps its position
                        const numberOfNewFiles = parts.length - 1;
                        await docUtil.shiftOrdinalsDown(owner_id, numberOfNewFiles, path.dirname(finalFilePath), originalOrdinal + 1, root);
                        
                        // Create a separate file for each content part
                        for (let i = 0; i < parts.length; i++) {
                            // Clean up content by removing whitespace and delimiter artifacts
                            const partContent = parts[i].trim();
                            let partFilePath = finalFilePath;
                            
                            if (i > 0) {
                                // VFS2: Generate new filename without ordinal prefix
                                const originalBaseName = path.basename(finalFilePath);
                                const nameWithoutExt = path.parse(originalBaseName).name;
                                const extension = path.parse(originalBaseName).ext;
                                const newBaseName = `${nameWithoutExt}_${i}${extension}`;
                                partFilePath = path.join(path.dirname(finalFilePath), newBaseName);
                            }
                                                        
                            // VFS2: Use writeFileEx with explicit ordinal
                            const targetOrdinal = originalOrdinal + i;
                            await vfs2.writeFileEx(owner_id, partFilePath, partContent, 'utf8', false, targetOrdinal);
                            
                            console.log(`Split file part ${i + 1} saved successfully: ${partFilePath}`);
                        }
                        
                        // Report successful splitting operation
                        console.log(`File split into ${parts.length} parts successfully`);
                        res.json({ message: `File split into ${parts.length} parts successfully` });
                    } else {
                        // No split delimiter found - save as single file
                        // Preserve existing ordinal if file exists
                        let existingOrdinal: number | undefined = undefined;
                        const fileInfo: any = {};
                        if (await vfs2.exists(finalFilePath, fileInfo) && fileInfo.node) {
                            existingOrdinal = fileInfo.node.ordinal;
                        }
                        
                        await vfs2.writeFileEx(owner_id, finalFilePath, content, 'utf8', false, existingOrdinal);
                        console.log(`File saved successfully: ${finalFilePath}`);
                        res.json({ message: 'File saved successfully (no split delimiter found)' });
                    }
                } else {
                    // Standard save operation without content splitting
                    // Preserve existing ordinal if file exists
                    let existingOrdinal: number | undefined = undefined;
                    const fileInfo: any = {};
                    if (await vfs2.exists(finalFilePath, fileInfo) && fileInfo.node) {
                        existingOrdinal = fileInfo.node.ordinal;
                    }
                    
                    await vfs2.writeFileEx(owner_id, finalFilePath, content, 'utf8', false, existingOrdinal);
                    console.log(`File saved successfully: ${finalFilePath}`);
                    res.json({ message: 'File saved successfully' });
                }
            } catch (error) {
                // Handle any errors that occurred during the save operation
                handleError(error, res, 'Failed to save file');

                // RETHROW! Or else transaction will not rollback
                throw error; // Re-throw the error for further handling if needed
            }
        })
    }
    
    /**
     * Renames a folder on the server for the tree viewer feature
     * 
     * This method provides secure folder renaming functionality within the document tree structure.
     * It includes comprehensive validation to prevent naming conflicts and ensure filesystem integrity.
     * 
     * Features:
     * - Validates folder existence before attempting rename
     * - Prevents naming conflicts with existing folders
     * - Maintains filesystem consistency
     * - Supports nested folder structures
     * 
     * @param req - Express request object containing:
     *   - oldFolderName: string - Current name of the folder to rename
     *   - newFolderName: string - Desired new name for the folder
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    renameFolder = async (req: Request<any, any, { oldFolderName: string; newFolderName: string; treeFolder: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            console.log("Rename Folder Request");
            try {
                // Extract request parameters
                const { oldFolderName, treeFolder } = req.body;
                let {newFolderName} = req.body;
                newFolderName = fixName(newFolderName); // Ensure valid folder name
            
                // Validate document root configuration
                const root = "/";

                // Validate required parameters
                if (!oldFolderName || !newFolderName || !treeFolder) {
                    res.status(400).json({ error: 'Old folder name, new folder name, and treeFolder are required' });
                    return;
                }

                // Construct absolute paths for the rename operation
                const absoluteParentPath = path.join(root, treeFolder);
                const oldAbsolutePath = path.join(absoluteParentPath, oldFolderName);
                const newAbsolutePath = path.join(absoluteParentPath, newFolderName);

                // Verify the parent directory exists
                if (!await vfs2.exists(absoluteParentPath)) {
                    res.status(404).json({ error: 'Parent directory not found' });
                    return;
                }

                // Verify the folder to be renamed exists
                if (!await vfs2.exists(oldAbsolutePath)) {
                    res.status(404).json({ error: 'Old folder not found' });
                    return;
                }

                // Ensure the target is actually a directory, not a file
                const stat = await vfs2.stat(oldAbsolutePath);
                if (!stat.is_directory) {
                    res.status(400).json({ error: 'Path is not a directory' });
                    return;
                }

                // Handle no-op case where names are identical
                if (oldFolderName === newFolderName) {
                    res.json({ message: 'Folder name is unchanged' });
                    return;
                }

                // Prevent naming conflicts with existing folders
                if (await vfs2.exists(newAbsolutePath)) {
                    res.status(409).json({ error: 'A folder with the new name already exists' });
                    return;
                }

                await vfs2.rename(owner_id, oldAbsolutePath, newAbsolutePath);
            
                // console.log(`Folder renamed successfully: ${oldAbsolutePath} -> ${newAbsolutePath}`);
                res.json({ message: 'Folder renamed successfully' });
            } catch (error) {
            // Handle any errors that occurred during the rename operation
                handleError(error, res, 'Failed to rename folder');
                throw error;
            }
        });
    }

    /**
     * Deletes one or more files or folders from the server
     * 
     * This method provides flexible deletion functionality supporting both single-item and batch operations.
     * It safely handles both files and directories with recursive deletion for folders containing nested content.
     * 
     * Features:
     * - Single item deletion via fileOrFolderName parameter
     * - Batch deletion via fileNames array parameter
     * - Recursive directory deletion with force option
     * - Detailed error reporting for batch operations
     * - Security validation for all deletion operations
     * - Backward compatibility for single-item responses
     * 
     * @param req - Express request object containing:
     *   - fileOrFolderName?: string - Single item to delete (legacy parameter)
     *   - fileNames?: string[] - Array of items to delete (batch mode)
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    deleteFileOrFolder = async (req: Request<any, any, { fileOrFolderName?: string; fileNames?: string[]; treeFolder: string }>, res: Response): 
    Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            // console.log("Delete File or Folder Request");
            try {
            // Extract request parameters
                const { fileOrFolderName, fileNames, treeFolder } = req.body;
            
                // Validate document root configuration
                const root = "/";

                // Determine operation mode and build items list
                let itemsToDelete: string[] = [];
                if (fileNames && Array.isArray(fileNames)) {
                // Multiple items mode
                    itemsToDelete = fileNames;
                } else if (fileOrFolderName) {
                // Single item mode
                    itemsToDelete = [fileOrFolderName];
                } else {
                    res.status(400).json({ error: 'Either fileOrFolderName or fileNames array and treeFolder are required' });
                    return;
                }

                if (!treeFolder || itemsToDelete.length === 0) {
                    res.status(400).json({ error: 'treeFolder and at least one item to delete are required' });
                    return;
                }

                // Construct the absolute parent path
                const absoluteParentPath = path.join(root, treeFolder);

                // Check if the parent directory exists
                if (!await vfs2.exists(absoluteParentPath)) {
                    res.status(404).json({ error: 'Parent directory not found' });
                    return;
                }

                let deletedCount = 0;
                const errors: string[] = [];

                // Delete each file/folder
                for (const fileName of itemsToDelete) {
                    try {
                        const absoluteTargetPath = path.join(absoluteParentPath, fileName);

                        // Check if the target exists
                        if (!await vfs2.exists(absoluteTargetPath)) {
                            errors.push(`File or folder not found: ${fileName}`);
                            continue;
                        }

                        // Get stats to determine if it's a file or directory
                        const stat = await vfs2.stat(absoluteTargetPath);
                    
                        if (stat.is_directory) {
                            // Remove directory recursively
                            await vfs2.rm(owner_id, absoluteTargetPath, { recursive: true, force: true });
                            // console.log(`Folder deleted successfully: ${absoluteTargetPath}`);
                        } else {
                            // Remove file
                            await vfs2.unlink(owner_id, absoluteTargetPath);
                            // console.log(`File deleted successfully: ${absoluteTargetPath}`);
                        }
                    
                        deletedCount++;
                    } catch (error) {
                        console.error(`Error deleting ${fileName}:`, error);
                        errors.push(`Failed to delete ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        throw error;
                    }
                }

                // Return appropriate response based on single vs multiple items
                if (itemsToDelete.length === 1) {
                // Single item mode - return simple response for backward compatibility
                    if (deletedCount === 1) {
                        const message = itemsToDelete[0].includes('.') ? 'File deleted successfully' : 'Folder deleted successfully';
                        res.json({ message });
                    } else {
                        res.status(500).json({ error: errors[0] || 'Failed to delete item' });
                    }
                } else {
                // Multiple items mode - return detailed response
                    res.json({ 
                        deletedCount, 
                        errors: errors.length > 0 ? errors : undefined,
                        message: `Successfully deleted ${deletedCount} of ${itemsToDelete.length} items` 
                    });
                }
            } catch (error) {
                handleError(error, res, 'Failed to delete file or folder');
                throw error;
            }
        });
    }

    /**
     * Moves a file or folder up or down in the ordered list by swapping numeric prefixes
     * 
     * This method implements ordinal-based repositioning for files and folders within a directory.
     * It works by swapping the numeric prefixes (ordinals) between the target item and an adjacent item
     * to change their display order in the tree viewer.
     * 
     * How it works:
     * - Files/folders use numeric prefixes (e.g., "0001_", "0002_") to determine sort order
     * - "Move up" swaps ordinals with the item that has the next lower ordinal
     * - "Move down" swaps ordinals with the item that has the next higher ordinal
     * - Uses temporary file renaming to prevent naming conflicts during the swap
     * 
     * Features:
     * - Supports both files and directories
     * - Validates movement boundaries (can't move up from top, down from bottom)
     * - Atomic operation using temporary files to prevent conflicts
     * - Returns detailed information about the swap for UI updates
     * - Security validation for all file operations
     * 
     * @param req - Express request object containing:
     *   - direction: string - Movement direction, must be "up" or "down"
     *   - filename: string - Name of the file or folder to move
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    /**
     * Moves a file or folder up or down in the ordering within its parent directory
     * 
     * This operation swaps the ordinal values of two adjacent items in the directory listing,
     * effectively changing their display order. The ordinals are stored as integer values in 
     * the database and control the sorting order independent of filenames.
     * 
     * Process:
     * 1. Validates the target file/folder exists in the specified directory
     * 2. Retrieves all items in the directory with their ordinal values
     * 3. Sorts items by ordinal to establish current ordering
     * 4. Identifies the adjacent item to swap with (up = previous item, down = next item)
     * 5. Swaps the ordinal values in the database using VFS2.setOrdinal()
     * 
     * Features:
     * - Database-based ordinal swapping (no file renaming required)
     * - Validates boundary conditions (can't move top item up or bottom item down)
     * - Atomic operation within transaction context
     * - Returns success message upon completion
     * 
     * @param req - Express request object containing:
     *   - direction: string - "up" or "down" to specify move direction
     *   - filename: string - Name of the file/folder to move
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    moveUpOrDown = async (req: Request<any, any, { direction: string; filename: string; treeFolder: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            // Console log a pretty print of test request parameters
            console.log(`Move Up/Down Request: arguments = ${JSON.stringify(req.body, null, 2)}`);
        
            try {
                // Extract request parameters
                const { direction, filename, treeFolder } = req.body;
            
                // Validate document root configuration
                const root = "/";

                // Validate required parameters and direction values
                if (!direction || !filename || !treeFolder || (direction !== 'up' && direction !== 'down')) {
                    res.status(400).json({ error: 'Valid direction ("up" or "down"), filename, and treeFolder are required' });
                    return;
                }

                // Construct absolute path to the parent directory
                const absoluteParentPath = path.join(root, treeFolder);

                // Verify the parent directory exists
                if (!await vfs2.exists(absoluteParentPath)) {
                    res.status(404).json({ error: `Parent directory not found: ${absoluteParentPath}` });
                    return;
                }

                // Read directory contents with ordinal information
                const treeNodes = await vfs2.readdirEx(owner_id, absoluteParentPath, false);
            
                // Sort by ordinal to establish current ordering
                treeNodes.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

                // Locate the target file/folder in the ordered list
                const currentIndex = treeNodes.findIndex(node => node.name === filename);
                if (currentIndex === -1) {
                    res.status(404).json({ error: `File not found in directory: ${filename}` });
                    return;
                }

                // Calculate the target position for the ordinal swap
                let targetIndex: number;
                if (direction === 'up') {
                    // Check if already at the top of the list
                    if (currentIndex === 0) {
                        res.status(400).json({ error: 'File is already at the top' });
                        return;
                    }
                    targetIndex = currentIndex - 1;
                } else { // direction === 'down'
                    // Check if already at the bottom of the list
                    if (currentIndex === treeNodes.length - 1) {
                        res.status(400).json({ error: 'File is already at the bottom' });
                        return;
                    }
                    targetIndex = currentIndex + 1;
                }

                // Get the two nodes that will swap ordinals
                const currentNode = treeNodes[currentIndex];
                const targetNode = treeNodes[targetIndex];

                // Swap ordinal values in the database using atomic swap function
                if (currentNode.uuid && targetNode.uuid) {
                    await vfs2.swapOrdinals(currentNode.uuid, targetNode.uuid);
                } else {
                    res.status(500).json({ error: 'Unable to swap ordinals: missing UUID' });
                    return;
                }

                // console.log(`Ordinals swapped successfully: ${currentNode.name} <-> ${targetNode.name}`);
            
                // Return success message
                res.json({ 
                    message: 'Files moved successfully',
                    file1: currentNode.name,
                    file2: targetNode.name
                });
            } catch (error) {
                // Handle any errors that occurred during the move operation
                handleError(error, res, 'Failed to move file or folder');
                throw error;
            }
        });
    }

    setPublic = async (req: Request<any, any, { is_public: boolean; filename: string; treeFolder: string; recursive?: boolean }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            try {
                // Extract request parameters
                const { is_public, filename } = req.body;
                let {treeFolder} = req.body;
                treeFolder = normalizePath(treeFolder); // Ensure treeFolder is normalized
                const recursive = req.body.recursive === true; // Default to false if not provided
                
                // Validate document root configuration
                const root = "/";

                // Validate required parameters
                if (is_public === undefined || !filename || !treeFolder) {
                    res.status(400).json({ error: 'is_public status, filename, and treeFolder are required' });
                    return;
                }

                // Construct absolute paths for the operation
                const absoluteParentPath = path.join(root, treeFolder);
                const absoluteFilePath = path.join(absoluteParentPath, filename);

                // Check if the specified file/folder exists
                if (!await vfs2.exists(absoluteFilePath)) {
                    res.status(404).json({ error: 'File or folder not found' });
                    return;
                }

                // Use VFS2 method to set public status
                const result = await vfs2.setPublic(owner_id, treeFolder, filename, is_public, recursive);
                    
                if (result.success) {
                    res.json({ 
                        message: result.diagnostic 
                    });
                } else {
                    res.status(500).json({ error: result.diagnostic });
                }
                
            } catch (error) {
                handleError(error, res, 'Failed to set public status');
                throw error;
            }
        });
    }

    /**
     * Pastes items from the cut list to the target folder by moving them with proper ordinal positioning
     * 
     * This is a sophisticated file/folder moving operation that supports both cross-folder moves and
     * same-folder reordering with intelligent ordinal management. It handles complex scenarios like
     * inserting items at specific positions while maintaining proper ordinal sequencing.
     * 
     * Key Features:
     * - Positional pasting at specific ordinal locations or appending to end
     * - Cross-folder moves with automatic ordinal assignment
     * - Same-folder reordering by updating database ordinal values
     * - Automatic ordinal shifting to make room for new items
     * - Batch operations supporting multiple items simultaneously
     * - Comprehensive error reporting for failed operations
     * - UUID-based item identification for reliable database operations
     * 
     * Ordinal Management (VFS2):
     * - Ordinals are stored as integer values in the database
     * - When inserting at a specific position, existing items' ordinals are shifted
     * - Same-folder operations update ordinals directly (no file moving needed)
     * - Cross-folder operations move files and assign new ordinals
     * - Filenames remain unchanged (ordinals not part of filename)
     * - Items to paste are retrieved and sorted by their current ordinal values
     * 
     * @param req - Express request object containing:
     *   - targetFolder: string - Relative path to the destination folder
     *   - pasteItems: string[] - Array of item UUIDs to move (retrieved from database and sorted by ordinal)
     *   - targetOrdinal?: number - Optional ordinal position for insertion (items inserted after this)
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */ 
    pasteItems = async (req: Request<any, any, { targetFolder: string; pasteItems: string[], targetOrdinal?: number }>, res: Response): Promise<void> => {    
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            try {
                const { targetFolder, pasteItems: pasteItemUuids, targetOrdinal } = req.body;
                const root = "/"
    
                if (!targetFolder || !pasteItemUuids || !Array.isArray(pasteItemUuids) || pasteItemUuids.length === 0) {
                    res.status(400).json({ error: 'targetFolder and pasteItems array are required' });
                    return;
                }
    
                // Construct the absolute target path
                const absoluteTargetPath = path.join(root, targetFolder);
    
                // Check if the target directory exists
                if (!await vfs2.exists(absoluteTargetPath)) {
                    res.status(404).json({ error: 'Target directory not found' });
                    return;
                }

                // Query the database to get the full node information for each UUID
                // This retrieves the parent_path, filename, ordinal, and other metadata
                const nodeInfos: { uuid: string; parent_path: string; filename: string; ordinal: number; fullPath: string }[] = [];
                
                for (const uuid of pasteItemUuids) {
                    const compactNode = await vfs2.getCompactNodeById(uuid, "usr");
                    
                    if (!compactNode) {
                        console.warn(`Item with UUID ${uuid} not found in database, skipping`);
                        continue;
                    }
                    
                    const fullPath = compactNode.parent_path ? `${compactNode.parent_path}/${compactNode.filename}` : compactNode.filename;
                    
                    nodeInfos.push({
                        uuid: compactNode.uuid,
                        parent_path: compactNode.parent_path,
                        filename: compactNode.filename,
                        ordinal: compactNode.ordinal,
                        fullPath: fullPath
                    });
                }
                
                // Sort the items by their current ordinal to preserve the original ordering
                nodeInfos.sort((a, b) => a.ordinal - b.ordinal);
                
                // Build the pasteItems array with full paths in the correct ordinal order
                const pasteItems = nodeInfos.map(info => info.fullPath);
    
                let pastedCount = 0;
                const errors: string[] = [];
    
                // Determine insert ordinal for positional pasting
                // If targetOrdinal is provided and not -1, insert after it; otherwise insert at position 0
                // The client sends -1 when pasting at the top (before first item)
                const insertOrdinal = (targetOrdinal !== undefined && targetOrdinal !== -1) ? targetOrdinal + 1 : 0;
    
                // Check if any of the items being pasted are from the same target directory
                // Normalize paths: both '/' and '.' represent root, normalize to ''
                const targetFolderNormalized = (targetFolder === '/' || targetFolder === '.') ? '' : targetFolder;
                const isSameFolderOperation = pasteItems.some(fullPath => {
                    const itemDir = path.dirname(fullPath);
                    const itemDirNormalized = (itemDir === '/' || itemDir === '.') ? '' : itemDir;
                    return itemDirNormalized === targetFolderNormalized;
                });
            
                if (isSameFolderOperation) {
                    // For same-folder operations: we're just reordering items within the same directory
                    
                    // Get the UUIDs and current ordinals of items being moved
                    // We can use the nodeInfos we already retrieved instead of looking them up again
                    const itemsToMove: { uuid: string; fullPath: string; currentOrdinal: number; name: string }[] = [];
                    
                    for (const nodeInfo of nodeInfos) {
                        const itemDir = nodeInfo.parent_path;
                        const itemDirNormalized = (itemDir === '/' || itemDir === '.') ? '' : itemDir;
                        
                        // Only handle items from the same directory
                        if (itemDirNormalized === targetFolderNormalized) {
                            itemsToMove.push({
                                uuid: nodeInfo.uuid,
                                fullPath: nodeInfo.fullPath,
                                currentOrdinal: nodeInfo.ordinal,
                                name: nodeInfo.filename
                            });
                        }
                    }
                    
                    // Items are already sorted by ordinal from our earlier query
                    console.log('Items to move:', itemsToMove.map(i => `${i.name}(ord=${i.currentOrdinal})`).join(', '));
                    
                    // Get all nodes in the directory to identify stationary items
                    const treeNodes = await vfs2.readdirEx(owner_id, absoluteTargetPath, false);
                    
                    // Get items that are NOT being moved
                    const movingUuids = new Set(itemsToMove.map(item => item.uuid));
                    const stationaryItems = treeNodes
                        .filter(node => node.uuid && node.ordinal !== undefined && !movingUuids.has(node.uuid))
                        .sort((a, b) => a.ordinal! - b.ordinal!);
                    console.log('Stationary items:', stationaryItems.map(i => `${i.name}(ord=${i.ordinal})`).join(', '));
                    
                    // Calculate new ordinals:
                    // 1. Items with ordinal < insertOrdinal keep their relative order
                    // 2. Moving items are inserted at insertOrdinal
                    // 3. Items with ordinal >= insertOrdinal are shifted down
                    const newOrdinals = new Map<string, number>();
                    let nextOrdinal = 0;
                    
                    // Process stationary items that were BEFORE the insert position
                    console.log('Processing stationary items BEFORE insertOrdinal:', insertOrdinal);
                    for (const item of stationaryItems) {
                        // Compare item's ACTUAL ordinal with insertOrdinal, not nextOrdinal
                        if (item.ordinal! >= insertOrdinal) {
                            console.log(`    Yes, breaking`);
                            break;
                        }
                        newOrdinals.set(item.uuid!, nextOrdinal++);
                    }
                    
                    // Insert moving items at the target position
                    for (const item of itemsToMove) {
                        console.log(`  ${item.name}: ${item.currentOrdinal} -> ${nextOrdinal}`);
                        newOrdinals.set(item.uuid, nextOrdinal++);
                    }
                    
                    // Process remaining stationary items that were AT OR AFTER insert position
                    for (const item of stationaryItems) {
                        if (newOrdinals.has(item.uuid!)) {
                            continue; // Already processed (was before insertOrdinal)
                        }
                        newOrdinals.set(item.uuid!, nextOrdinal++);
                    }
                    
                    // Apply all ordinal changes in two phases to avoid unique constraint violations:
                    // Phase 1: Set all items to temporary negative ordinals (based on their index)
                    // Phase 2: Set all items to their final ordinals
                    // This prevents conflicts when swapping ordinals (e.g., A:0->1, B:1->0)
                    let tempOrdinal = -2147483648; // Start with min integer value
                    const tempOrdinalMap = new Map<string, number>();
                    
                    console.log('Phase 1: Setting temporary ordinals to avoid conflicts');
                    for (const [uuid] of newOrdinals.entries()) {
                        const nodeName = treeNodes.find(n => n.uuid === uuid)?.name;
                        console.log(`  ${nodeName}(${uuid}): -> temp ordinal ${tempOrdinal}`);
                        await vfs2.setOrdinal(uuid, tempOrdinal);
                        tempOrdinalMap.set(uuid, tempOrdinal);
                        tempOrdinal++; // Each item gets a unique temporary ordinal
                    }
                    
                    console.log('Phase 2: Setting final ordinals');
                    for (const [uuid, newOrdinal] of newOrdinals.entries()) {
                        const nodeName = treeNodes.find(n => n.uuid === uuid)?.name;
                        console.log(`  ${nodeName}(${uuid}): -> ${newOrdinal}`);
                        await vfs2.setOrdinal(uuid, newOrdinal);
                    }
                    
                    pastedCount += itemsToMove.length;
                } else {
                    // For cross-folder operations: move files and assign new ordinals
                    // Shift existing items' ordinals down to make room
                    await vfs2.shiftOrdinalsDown(owner_id, absoluteTargetPath, insertOrdinal, pasteItems.length);
                    
                    // Move each file/folder and assign ordinals
                    for (let i = 0; i < pasteItems.length; i++) {
                        const itemFullPath = pasteItems[i];
                        try {
                            const itemName = path.basename(itemFullPath);
                            const sourceFilePath = path.join(root, itemFullPath);
                        
                            // Check if source file exists
                            if (!await vfs2.exists(sourceFilePath)) {
                                errors.push(`Source file not found: ${itemFullPath}`);
                                continue;
                            }

                            const targetFilePath = path.join(absoluteTargetPath, itemName);

                            // Safety check: ensure target doesn't already exist to prevent overwriting
                            if (await vfs2.exists(targetFilePath)) {
                                errors.push(`Target file already exists: ${itemName}`);
                                continue;
                            }

                            // Move the file/folder
                            await vfs2.rename(owner_id, sourceFilePath, targetFilePath);
                            
                            // Get the UUID of the moved item and set its ordinal
                            const treeNodes = await vfs2.readdirEx(owner_id, absoluteTargetPath, false);
                            const movedNode = treeNodes.find(n => n.name === itemName);
                            
                            if (movedNode && movedNode.uuid) {
                                const newOrdinal = insertOrdinal + i;
                                await vfs2.setOrdinal(movedNode.uuid, newOrdinal);
                            }
                            
                            pastedCount++;
                        } catch (error) {
                            errors.push(`Failed to move ${itemFullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                }
    
                // Return response
                res.json({
                    pastedCount,
                    totalItems: pasteItems.length,
                    errors: errors.length > 0 ? errors : undefined,
                    message: `Successfully pasted ${pastedCount} of ${pasteItems.length} items`
                });
            } catch (error) {
                handleError(error, res, 'Failed to paste items');
                throw error;
            }
        });
    }    
    
    /**
     * Joins multiple selected files by concatenating their content and saving to the first file
     * 
     * This method combines the content of multiple text files into a single file, preserving the ordinal
     * order for proper sequencing. It's useful for merging split documents or combining related content
     * that was previously separated across multiple files.
     * 
     * Process:
     * 1. Validates that at least 2 files are selected for joining
     * 2. Reads content from all selected files
     * 3. Sorts files by their ordinal values stored in the database to maintain proper order
     * 4. Concatenates content with double newline separators ("\n\n")
     * 5. Saves the combined content to the first file (by ordinal order)
     * 6. Deletes all other files that were joined
     * 
     * Features:
     * - Requires minimum of 2 files for joining operation
     * - Automatically sorts files by ordinal values from database before joining
     * - Handles text files with UTF-8 encoding
     * - Graceful error handling for unreadable files
     * - Content separation with consistent double newlines
     * - Atomic operation - either all files join successfully or none do
     * 
     * Security:
     * - Validates file existence before attempting to read
     * - Ensures all file operations stay within the configured document root
     * - Properly handles file access permissions
     * 
     * @param req - Express request object containing:
     *   - filenames: string[] - Array of filenames to join (minimum 2 required)
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns void - Asynchronous operation
     */
    joinFiles = async (req: Request<any, any, { filenames: string[]; treeFolder: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            try {
            // Extract request parameters
                const { filenames, treeFolder } = req.body;
            
                // Validate document root configuration
                const root = "/";
        
                // Validate that we have enough files to perform a join operation
                if (!filenames || !Array.isArray(filenames) || filenames.length < 2) {
                    res.status(400).json({ error: 'At least 2 filenames are required for joining' });
                    return;
                }
        
                // Validate required tree folder parameter
                if (!treeFolder) {
                    res.status(400).json({ error: 'Tree folder is required' });
                    return;
                }
        
                // Construct absolute path and validate security access
                const absoluteFolderPath = path.join(root, treeFolder);
        
                // Read content from all files and collect metadata for sorting
                const fileData: { filename: string; ordinal: number; content: string; node: TreeNode }[] = [];
                    
                for (const filename of filenames) {
                // Construct path and validate file access permissions
                    const absoluteFilePath = path.join(absoluteFolderPath, filename);
                        
                    // Verify file exists and get node information including ordinal
                    const info: any = {};
                    if (!await vfs2.exists(absoluteFilePath, info)) {
                        res.status(404).json({ error: `File not found: ${filename}` });
                        return;
                    }
                    
                    const node = info.node as TreeNode;
                    if (!node) {
                        res.status(500).json({ error: `Could not get node information for: ${filename}` });
                        return;
                    }
        
                    // Get ordinal from the node (stored in database)
                    const ordinal = node.ordinal || 0;
                        
                    // Read file content with error handling for unreadable files
                    let content = '';
                    try {
                        content = await vfs2.readFile(owner_id, absoluteFilePath, 'utf8') as string;
                    } catch (error) {
                        console.warn(`Could not read file ${filename} as text:`, error);
                        // Continue with empty content rather than failing the entire operation
                        throw error;
                    }
        
                    // Store file data for sorting and joining
                    fileData.push({ filename, ordinal, content, node });
                }
        
                // Sort files by ordinal to maintain proper document order
                fileData.sort((a, b) => a.ordinal - b.ordinal);
        
                // Concatenate content with consistent double newline separators
                const joinedContent = fileData.map(file => file.content).join('\n\n');
        
                // Save combined content to the first file (lowest ordinal)
                const firstFile = fileData[0];
                const firstFilePath = path.join(absoluteFolderPath, firstFile.filename);
                    
                // Write the joined content with security validation
                await vfs2.writeFile(owner_id, firstFilePath, joinedContent, 'utf8');
                console.log(`Joined content saved to: ${firstFile.filename}`);
        
                // Clean up by deleting all files except the first one
                const deletedFiles: string[] = [];
                for (let i = 1; i < fileData.length; i++) {
                    const fileToDelete = fileData[i];
                    const deleteFilePath = path.join(absoluteFolderPath, fileToDelete.filename);
                        
                    try {
                    // Validate access and delete the file
                        await vfs2.unlink(owner_id, deleteFilePath);
                        deletedFiles.push(fileToDelete.filename);
                        console.log(`Deleted file: ${fileToDelete.filename}`);
                    } catch (error) {
                        console.error(`Error deleting file ${fileToDelete.filename}:`, error);
                        // Continue with other deletions even if one fails
                        throw error;
                    }
                }
        
                // Return success response with operation details
                res.json({ 
                    message: `Successfully joined ${fileData.length} files into ${firstFile.filename}`,
                    joinedFile: firstFile.filename,
                    deletedFiles: deletedFiles
                });
        
            } catch (error) {
            // Handle any errors that occurred during the join operation
                handleError(error, res, 'Failed to join files');
                throw error;
            }
        });
    }

    /**
     * Converts a file into a folder by preserving its ordinal position in the directory
     * 
     * This method provides a transformation feature that converts an existing file into a folder structure.
     * It's useful for reorganizing content when a simple file needs to be expanded into a more complex
     * hierarchical structure while preserving the existing content.
     * 
     * Process:
     * 1. Validates the existing file and proposed folder name
     * 2. Retrieves the file's ordinal value from the database
     * 3. Deletes the original file from the virtual filesystem
     * 4. Creates a new folder with the same ordinal value
     * 5. If remaining content exists, creates a new file inside the folder with that content
     * 
     * Features:
     * - Preserves ordinal positioning in the document tree (stored as integer in database)
     * - Validates folder name length to prevent issues
     * - Handles optional content preservation in a new file
     * - Prevents conflicts with existing folders
     * - Maintains proper security access controls
     * - Atomic operation - either fully succeeds or fails cleanly
     * 
     * Ordinal Preservation (VFS2):
     * - The new folder inherits the ordinal value from the original file
     * - Ordinals are stored as integers in the database, not in filenames
     * - This maintains the exact position in the sorted document tree
     * - Example: File "myfile.md" with ordinal=3 becomes folder "myfolder" with ordinal=3
     * 
     * Content Handling:
     * - If remainingContent is provided, creates "file.md" inside the new folder
     * - This allows preservation of the original file's content after the conversion
     * - The new file gets ordinal=1 within the folder (first item)
     * 
     * @param req - Express request object containing:
     *   - filename: string - Name of the existing file to convert
     *   - folderName: string - Desired name for the new folder
     *   - remainingContent: string - Optional content to save in a new file inside the folder
     *   - treeFolder: string - Relative path to the parent directory
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    buildFolder = async (req: Request<any, any, { filename: string; folderName: string; remainingContent: string; treeFolder: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            console.log("Make Folder Request");
            try {
                // Extract request parameters
                const { filename, remainingContent, treeFolder } = req.body;
                let { folderName } = req.body;
                folderName = fixName(folderName); // Ensure no leading/trailing whitespace
            
                // Validate document root configuration
                const root = "/";

                // Validate required parameters
                if (!filename || !folderName || !treeFolder) {
                    res.status(400).json({ error: 'Filename, folder name, and treeFolder are required' });
                    return;
                }

                // Prevent excessively long folder names that could cause filesystem issues
                if (folderName.length > 140) {
                    res.status(400).json({ error: 'Folder name is too long. Maximum 140 characters allowed.' });
                    return;
                }

                // Construct absolute paths for the conversion operation
                const absoluteFolderPath = path.join(root, treeFolder);
                const absoluteFilePath = path.join(absoluteFolderPath, filename);

                // Verify the parent directory exists and is accessible
                if (!await vfs2.exists(absoluteFolderPath)) {
                    res.status(404).json({ error: 'Parent directory not found' });
                    return;
                }

                // Verify the target file exists and get its info (including ordinal)
                const fileInfo: any = {};
                if (!await vfs2.exists(absoluteFilePath, fileInfo)) {
                    res.status(404).json({ error: 'File not found' });
                    return;
                }

                // Ensure the target is actually a file, not a directory
                const fileStat = fileInfo.node;
                if (fileStat.is_directory) {
                    res.status(400).json({ error: 'Path is not a file' });
                    return;
                }

                // Retrieve the ordinal value from the file's database record
                // This will be preserved when creating the new folder
                const preservedOrdinal = fileStat.ordinal;
            
                // Construct the new folder path (no ordinal prefix in filename)
                const absoluteNewFolderPath = path.join(absoluteFolderPath, folderName);

                // Prevent naming conflicts with existing folders
                if (await vfs2.exists(absoluteNewFolderPath)) {
                    res.status(409).json({ error: 'A folder with this name already exists' });
                    return;
                }

                // Perform the conversion: delete original file and create folder
                // Step 1: Remove the original file with security validation
                await vfs2.unlink(owner_id, absoluteFilePath);
                console.log(`File deleted: ${absoluteFilePath}`);

                // Step 2: Create the new folder structure with the preserved ordinal
                // Use mkdirEx to specify the ordinal value
                await vfs2.mkdirEx(owner_id, absoluteNewFolderPath, { recursive: true }, fileStat.is_public, preservedOrdinal);
                console.log(`Folder created: ${absoluteNewFolderPath} with ordinal: ${preservedOrdinal}`);

                // Step 3: Optionally preserve content in a new file inside the folder
                if (remainingContent && remainingContent.trim().length > 0) {
                    // Create a default file with ordinal=1 to store the remaining content
                    const newFileName = 'file.md';
                    const newFilePath = path.join(absoluteNewFolderPath, newFileName);
                
                    // Write the preserved content with security validation and ordinal=1
                    // Use writeFileEx to specify the ordinal value
                    await vfs2.writeFileEx(owner_id, newFilePath, remainingContent, 'utf8', fileStat.is_public, 1);
                    console.log(`New file created with remaining content: ${newFilePath}`);
                }

                // Return success response with conversion details
                res.json({ 
                    message: `File "${filename}" converted to folder "${folderName}" successfully${remainingContent && remainingContent.trim().length > 0 ? ' with remaining content saved as file.md' : ''}`,
                    folderName: folderName
                });
            } catch (error) {
                handleError(error, res, 'Failed to convert file to folder');
                throw error;
            }
        });
    }     
    
    /**
     * HTTP endpoint handler for VFS (PostgreSQL-based) text file search.
     * 
     * This method provides search capabilities across text files stored in the PostgreSQL VFS.
     * It uses the vfs_search_text function to perform database-level text searching,
     * returning file-level matches without line numbers (unlike the grep-based search).
     * 
     * Search Modes:
     * - REGEX: Treats query as regular expression
     * - MATCH_ANY: Finds files containing any search terms (OR logic)
     * - MATCH_ALL: Finds files containing all search terms (AND logic)
     * 
     * Empty Query Handling:
     * - Empty, null, or undefined queries are treated as "match everything"
     * - Automatically converts to REGEX mode with pattern ".*" to match all content
     * - Returns file-level results only (no line-by-line content)
     * - Useful for browsing all VFS content in a directory structure
     * 
     * Features:
     * - PostgreSQL native text search for better performance
     * - File-level results (no line numbers)
     * - Timestamp filtering support
     * - Modification time ordering
     * - Consistent API with existing search endpoints
     */
    // todo-1: Most of the advanced search options are not yet enabled here yet, and need to be written as VFS versions of else removed.
    searchVFSFiles = async (req: Request<any, any, {  
        query?: string; 
        treeFolder: string; 
        searchMode?: string,
        searchOrder?: string }>, res: Response): Promise<void> => {
        console.log("VFS Document Search Request");
        try {
            let user_id = (req as any).userProfile ? (req as AuthenticatedRequest).userProfile?.id : 0; 
            if (!user_id) {
                user_id = ANON_USER_ID;
            } 

            // Extract and validate parameters
            const { treeFolder, searchOrder = 'MOD_TIME' } = req.body;
            let { query, searchMode = 'MATCH_ANY' } = req.body;
            
            // Handle empty, null, or undefined query as "match everything"
            const isEmptyQuery = !query || query.trim() === '';
            if (isEmptyQuery) {
                query = '.*'; // Regex pattern that matches any content
                searchMode = 'REGEX'; // Force REGEX mode for match-all behavior
                console.log('Empty query detected in VFS search, using match-all pattern for file-level results');
            }
            
            // Validate required parameters
            if (!treeFolder || typeof treeFolder !== 'string') {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }

            console.log(`VFS search query: "${query}" with mode: "${searchMode}" in folder: "${treeFolder}"`);
            
            // Call the VFS2 search method (returns already-transformed results)
            const results = await vfs2.search(user_id, query!, treeFolder, "usr", searchMode!, searchOrder!);
            
            // Send successful response in the same format as searchTextFiles
            res.json({ 
                message: `VFS search completed for query: "${query}". Found ${results.length} matching files.`,
                query: query,
                searchPath: treeFolder,
                searchMode: searchMode,
                resultCount: results.length,
                results: results
            });
            
        } catch (error) {
            console.error('VFS search error:', error);
            handleError(error, res, 'Failed to perform VFS search');
        }
    }
}

export const docMod = new DocMod();
