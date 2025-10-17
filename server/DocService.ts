import { ANON_USER_ID, TreeNode } from "../../../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import {  TreeRender_Response } from "../../../common/types/EndpointTypes.js";
import { AuthenticatedRequest, handleError, svrUtil, throwError } from "../../../server/ServerUtil.js";
import { config } from "../../../server/Config.js";
import { docUtil } from "./DocUtil.js";
import { IFS } from "./IFS.js";
import { runTrans } from "../../../server/db/Transactional.js";
import pgdb from "../../../server/db/PGDB.js";
import { fixName, getFilenameExtension, isImageExt } from '../../../common/CommonUtils.js';

/**
 * Service class for handling document management operations in the docs plugin.
 * 
 * This service provides comprehensive document management functionality including:
 * - Hierarchical folder/file navigation with ordinal-based naming
 * - File and folder creation with automatic ordinal positioning
 * - Advanced search capabilities across text files and PDFs
 * - Tree structure rendering with pullup folder support
 * - Path resolution for non-ordinal paths to ordinal-based paths
 * 
 * Key Features:
 * - All folders use 4-digit ordinal prefixes (e.g., "0001_FolderName")
 * - Supports ordinal-based insertion and automatic renumbering
 * - Multi-mode search (REGEX, MATCH_ANY, MATCH_ALL) with timestamp filtering
 * - Security validation for all file operations within allowed roots
 * - Support for various file types (text, images, PDFs, binary)
 * 
 * Public Methods:
 * 
 * Path Resolution:
 * - resolveNonOrdinalPath(): Converts user-friendly paths to ordinal-based paths
 * 
 * Tree Operations:
 * - treeRender(): HTTP endpoint for rendering directory tree structures
 * - getTreeNodes(): Core recursive tree building logic with pullup support
 * 
 * File Management:
 * - createFile(): HTTP endpoint for creating new files with ordinal positioning
 * - createFolder(): HTTP endpoint for creating new folders with ordinal positioning
 * 
 * Search Operations:
 * - searchTextFiles(): Advanced grep-based search with line-level results
 * - searchBinaries(): Comprehensive search including PDFs with file-level results
 * 
 * Security Model:
 * All operations are constrained by document root keys and undergo security validation
 * to prevent directory traversal attacks and unauthorized file access.
 * 
 * Ordinal System:
 * The service maintains a strict 4-digit ordinal prefix system (0000-9999) for all
 * files and folders, enabling precise ordering and insertion capabilities.
 */
class DocService {
    /**
     * Resolves a non-ordinal path to its corresponding ordinal-based path in the file system.
     * 
     * The file system uses folders with 4-digit ordinal prefixes (e.g., "1234_FolderName/5678_SubFolderName").
     * This method allows resolution of user-friendly paths like "FolderName/SubFolderName" to their
     * actual ordinal-based paths by performing directory lookups and name matching.
     * 
     * Algorithm:
     * 1. Decode and validate the input path
     * 2. Split path into individual folder components
     * 3. For each component, scan the current directory for matching ordinal folders
     * 4. Match folder names case-insensitively (ignoring ordinal prefix)
     * 5. Build the resolved ordinal path incrementally
     * 
     * Security: All paths are validated against the document root to prevent directory traversal
     *
     * @param docRootKey - Key identifier for the document root (resolved via config.getPublicFolderByKey)
     * @param treeFolder - Non-ordinal path to resolve (e.g., "FolderName/SubFolderName")
     * @returns The resolved path with ordinals (e.g., "/1234_FolderName/5678_SubFolderName"), or null if no path found
     */
    // todo-0: this method will be going away soon, since we are moving away from VFS to VFS2
    resolveNonOrdinalPath = async (owner_id: number, docRootKey: string, treeFolder: string, ifs: IFS): Promise<string | null> => {       
        treeFolder = ifs.normalizePath(treeFolder);
        // Resolve the document root path using the provided key
        const root = config.getPublicFolderByKey(docRootKey).path;
        if (!root) {
            throw new Error('Invalid document root key');
        }

        // Decode URL encoding and sanitize the tree folder path
        const decodedTreeFolder = decodeURIComponent(treeFolder);
        
        // Handle root directory case - return immediately
        if (decodedTreeFolder === '') {
            return '';
        }
        
        // Split the path into individual folder components, filtering out empty strings
        const folderComponents = decodedTreeFolder.split('/').filter(component => component.length > 0);
        
        // Initialize path resolution variables
        let currentPath = root;  // Current absolute path being examined
        let resolvedPath = '';   // Accumulated resolved path with ordinals
        
        // Process each folder component in the path
        for (let i = 0; i < folderComponents.length; i++) {
            const folderName = folderComponents[i];
            // console.log(`Resolving folder component: [${folderName}] at index ${i}`);
            
            // Verify current directory exists before attempting to read it
            if (!await ifs.exists(currentPath)) {
                // console.error(`Directory does not exist: ${currentPath}`);
                return null;
            }
            
            // Read directory contents to find matching folders
            const entries = await ifs.readdir(owner_id, currentPath);
            
            // Search for folder that matches the non-ordinal name
            let matchedFolder: string | null = null;
            
            for (const entry of entries) {
                // Skip hidden files (starting with .) and system files (starting with _)
                if (entry.startsWith('.') || entry.startsWith('_')) {
                    continue;
                }
                
                // Check if entry is a directory and follows ordinal naming convention
                const entryPath = ifs.pathJoin(currentPath, entry);
                const stat = await ifs.stat(entryPath);
                
                if (stat.is_directory && /^\d+_/.test(entry)) {
                    // Extract the folder name without the ordinal prefix
                    const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                    
                    // Perform case-insensitive comparison with target folder name
                    if (nameWithoutOrdinal.toLowerCase() === folderName.toLowerCase()) {
                        //console.log(`    Matched folder: "${entry}" -> "${nameWithoutOrdinal}"`);
                        matchedFolder = entry;
                        break;
                    }
                } else {
                    // Log non-matching entries for debugging purposes
                    console.log(`    Entry "${entry}" is ${!stat.is_directory ? 'not a directory' : 'directory without ordinal prefix'}`);
                }
            }
            
            // Handle case where no matching folder was found
            if (!matchedFolder) {
                // Log available options for debugging
                for (const entry of entries) {
                    const entryPath = ifs.pathJoin(currentPath, entry);
                    const stat = await ifs.stat(entryPath);
                    if (stat.is_directory && /^\d+_/.test(entry)) {
                        const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                        console.log(`  - "${entry}" -> "${nameWithoutOrdinal}"`);
                    }
                }
                return null;
            }
            
            // Update paths for next iteration
            currentPath = ifs.pathJoin(currentPath, matchedFolder);
            resolvedPath += '/' + matchedFolder;
        }
        // console.log(`Resolved final path: [${resolvedPath}]`);
        return resolvedPath;
    }

    /**
     * HTTP endpoint handler for rendering directory tree structure as TreeNode objects.
     * 
     * This method processes requests to render a hierarchical tree view of files and folders
     * in a specified directory. It supports an optional "pullup" mode where folders ending
     * with underscores have their contents included inline in the parent tree structure.
     * 
     * Request Processing:
     * 1. Extract and decode the tree folder path from the URL
     * 2. Validate the document root key and construct absolute paths
     * 3. Perform security checks to ensure path is within allowed bounds
     * 4. Generate TreeNode array representing the directory structure
     * 5. Return JSON response with tree data
     * 
     * Pullup Feature:
     * When pullup=true in query params, folders ending with '_' are treated as "pullup folders",
     * meaning their contents are included inline rather than as separate expandable nodes.
     * This provides a flattened view for organizational folders.
     * 
     * @param req - Express request object with params: {docRootKey}, query: {pullup?}
     * @param res - Express response object for JSON tree data
     * @returns Promise<void> - Sends TreeRender_Response as JSON or error response
     */
    treeRender = async (req: Request<{ docRootKey: string; 0: string }, any, any, { pullup?: string }>, res: Response): Promise<void> => {
        let user_id = (req as any).userProfile ? (req as AuthenticatedRequest).userProfile?.id : 0; 
        if (!user_id) {
            user_id = ANON_USER_ID;
        }                   
       
        try {
            // Extract the folder path from the wildcard part of the URL
            // The wildcard (*) in the route captures everything after docRootKey and stores it in req.params[0]
            const rawTreeFolder = req.params[0] || "/";
            let treeFolder = decodeURIComponent(rawTreeFolder);
            
            // Extract the pullup parameter from query string
            const pullup = req.query.pullup as string; 
            
            // Get the appropriate file system implementation
            const ifs = docUtil.getFileSystem(req.params.docRootKey);
            treeFolder = ifs.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
            // console.log(`Normalized treeFolder: [${treeFolder}]`);

            if (process.env.POSTGRES_HOST) {
                if (treeFolder.trim()=== '' || treeFolder === '/') {
                    if (user_id!=pgdb.adminProfile!.id) {
                        // If treeFolder is empty or root, we return the admin profile's root node
                        // This is a security measure to prevent unauthorized access to the admin's root
                        throwError(`Unauthorized access attempt by user ${user_id} to root node.`);
                    }
                }
            }
            
            // Resolve the document root path from the provided key
            const root = config.getPublicFolderByKey(req.params.docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // const slashFreeTreeFolder = treeFolder.replace(/^\//, ''); // Remove leading slashes
            // Use regex to check if treeFolder starts with pattern "NNNN_" where 4 is a numeric digit
        
            // Construct the absolute path to the target directory
            const absolutePath = ifs.pathJoin(root, treeFolder);

            const info: any = {};
            // Verify the target directory exists
            if (!await ifs.exists(absolutePath, info)) { 
                console.warn(`Directory does not exist: ${absolutePath}`);
                res.status(404).json({ error: `Directory not found: ${absolutePath}` });
                return;
            }

            // NOTE: Checks for root node will end up here with 'info.node' being empty object
            if (!info.node) {
                // If info.node is not available, we can assume it's a root node with no owner_id
                throw new Error(`Failed to create TreeNode ${absolutePath}`);
            }

            // Verify the target is actually a directory (not a file)
            if (!info.node.is_directory) {
                console.warn(`Path is not a directory: ${absolutePath}`);
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Generate the tree structure
            const treeNodes: TreeNode[] = await this.getTreeNodes(user_id, absolutePath, pullup==="true", root, ifs);
            // Send the tree data as JSON response
            const response: TreeRender_Response = { 
                user_id: user_id == ANON_USER_ID ? null : user_id,
                rootNode: info.node,
                treeNodes,
                treeFolder
            };
            res.json(response);

            // JSON pretty print the response
            // console.log(`Tree response for [${absolutePath}]\n`, JSON.stringify(response, null, 2));
        } catch (error) {
            // Handle any errors that occurred during tree rendering
            handleError(error, res, 'Failed to render tree');
        }
    }
 
    /**
     * Recursively builds an array of TreeNode objects representing the contents of a directory.
     * 
     * This method is the core tree-building engine that processes directory contents and creates
     * hierarchical tree structures. It handles ordinal-based file naming, file type detection,
     * content reading, and optional pullup folder expansion.
     * 
     * Processing Flow:
     * 1. Read directory contents and filter out hidden/system files
     * 2. Ensure all files have proper 4-digit ordinal prefixes
     * 3. Process each file/folder:
     *    - Determine type (folder, text, image, binary)
     *    - Read content for supported file types
     *    - Handle pullup folders by recursively including their contents
     * 4. Sort results alphabetically and return
     * 
     * File Type Detection:
     * - Folders: type='folder', may have children if pullup enabled
     * - Images (.png, .jpeg, .jpg): type='image', content=relative path
     * - Text files (.md, .txt): type='text', content=file contents
     * - Other files: type='binary', no content loaded
     * 
     * Ordinal Management:
     * All files/folders are ensured to have 4-digit ordinal prefixes (e.g., "0001_filename").
     * Files without ordinals are automatically assigned the next available number.
     * 
     * @param absolutePath - The absolute filesystem path to scan
     * @param pullup - If true, folders ending with '_' will have their contents included inline
     * @param root - The document root path for security validation
     * @returns Array of TreeNode objects representing directory contents, sorted alphabetically
     */
    getTreeNodes = async (owner_id: number, absolutePath: string, pullup: boolean, root: string, ifs: IFS): Promise<TreeNode[]> => { 
        // Read the directory contents
        let fileNodes = await ifs.readdirEx(owner_id, absolutePath, true);

        // This filters out hidden files and system files
        fileNodes = fileNodes.filter(file => !file.name.startsWith('.'));

        // Process each file/folder in the directory
        for (const file of fileNodes) {    
            // Get file information
            const filePath = ifs.pathJoin(absolutePath, file.name);

            // DIRECTORY
            if (file.is_directory) {
                // Handle pullup folders: folders ending with '_' get their contents inlined
                if (pullup && file.name.endsWith('_')) {
                    // Recursively get tree nodes for this pullup folder
                    file.children = await this.getTreeNodes(owner_id, filePath, true, root, ifs);
                    
                    // Set children to null if empty (cleaner JSON output)
                    if (file.children.length === 0) {
                        file.children = null;
                    }
                }
                
                // Check if folder has any children in the filesystem
                file.fsChildren = await ifs.childrenExist(owner_id, filePath);
            } 
            // FILE
            else {
                file.fsChildren = false; // Files do not have children
                // Process files based on their extension
                const ext = getFilenameExtension(file.name).toLowerCase();
                    
                // IMAGE FILE
                if (isImageExt(ext)) {
                    // Image files: store relative path for URL construction
                    // If filePath starts with root, strip the root part to get relative path
                    // console.log(`Processing image file: [${filePath}] under root [${root}]`);
                    const relativePath = filePath.startsWith(root) ? filePath.substring(root.length) : filePath;
                    file.url = relativePath; // Use absolute path for image display 
                } 
            }
        }
        return fileNodes;
    }

    /**
     * HTTP endpoint handler for creating new files in the document tree with proper ordinal positioning.
     * 
     * This method creates new files within the ordinal-based file system, automatically handling
     * ordinal assignment and ensuring proper positioning relative to existing files. It supports
     * insertion at specific positions or at the top of the directory.
     * 
     * Creation Process:
     * 1. Validate input parameters and document root access
     * 2. Determine insertion position based on insertAfterNode parameter
     * 3. Shift existing files down to make room for the new file
     * 4. Create new file with calculated ordinal prefix
     * 5. Auto-add .md extension if no extension provided
     * 
     * Ordinal Management:
     * - If insertAfterNode specified: new file gets (afterNode ordinal + 1)
     * - If no insertAfterNode: new file gets ordinal 0 (top position)
     * - All affected files are automatically renumbered to maintain sequence
     * 
     * File Naming Convention:
     * - Format: "NNNN_filename.ext" where NNNN is 4-digit zero-padded ordinal
     * - Default extension: .md (added if no extension provided)
     * 
     * @param req - Express request with body: {fileName, treeFolder, insertAfterNode, docRootKey}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created filename or error
     */
    createFile = async (req: Request<any, any, { fileName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            // console.log(`Create File Request: ${JSON.stringify(req.body, null, 2)}`);
            try {
                // Extract parameters from request body
                const { insertAfterNode, docRootKey } = req.body;
                let {treeFolder} = req.body;
                let {fileName} = req.body;
                fileName = fixName(fileName); // Ensure valid file name
            
                // Get the appropriate file system implementation
                const ifs = docUtil.getFileSystem(docRootKey);
                treeFolder = ifs.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
            
                // Resolve and validate document root
                const root = config.getPublicFolderByKey(docRootKey).path;
                if (!root) {
                    res.status(500).json({ error: 'bad root' });
                    return;
                }

                // Validate required parameters
                if (!fileName) {
                    res.status(400).json({ error: 'File name and treeFolder are required' });
                    return;
                }

                // Construct absolute path to parent directory
                const absoluteParentPath = ifs.pathJoin(root, treeFolder);

                // Verify parent directory exists and is accessible
                const info: any = {};
                if (!await ifs.exists(absoluteParentPath, info)) {
                    res.status(404).json({ error: `Parent directory not found [${absoluteParentPath}]` });
                    return;
                }

                // Calculate insertion ordinal based on insertAfterNode
                let insertOrdinal = 0; // Default: insert at top (ordinal 0)
                if (insertAfterNode && insertAfterNode.trim() !== '') {
                    console.log(`Create file "${fileName}" below node: ${insertAfterNode}`);
                
                    // For VFS2: insertAfterNode is just the filename, we need to get its ordinal from the database
                    // For legacy VFS: insertAfterNode has ordinal prefix, extract it
                    const fsType = docUtil.getFileSystemType(docRootKey);
                    if (fsType === 'vfs') {
                        // VFS2: Get ordinal from database
                        const afterNodePath = ifs.pathJoin(absoluteParentPath, insertAfterNode);
                        const afterNodeInfo: any = {};
                        if (await ifs.exists(afterNodePath, afterNodeInfo) && afterNodeInfo.node) {
                            insertOrdinal = afterNodeInfo.node.ordinal + 1;
                        }
                    } else {
                        // Legacy VFS: Extract ordinal from filename prefix
                        const underscoreIndex = insertAfterNode.indexOf('_');
                        if (underscoreIndex !== -1) {
                            const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                            insertOrdinal = afterNodeOrdinal + 1; // Insert after the reference node
                        }
                    }
                } else {
                    console.log(`Create new top file "${fileName}"`);
                }

                // Shift existing files down to make room for the new file
                // This ensures proper ordinal sequence is maintained
                await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root, null, ifs);
                
                // Auto-add .md extension if no extension is provided
                let finalFileName = fileName;
                if (!getFilenameExtension(fileName)) {
                    finalFileName = `${fileName}.md`;
                }

                // Determine the file system type to handle filename creation differently
                const fsType = docUtil.getFileSystemType(docRootKey);
                let newFilePath: string;
                let fileNameToReturn: string;
                
                if (fsType === 'vfs') {
                    // VFS2: No ordinal prefix in filename, ordinal is stored in database
                    newFilePath = ifs.pathJoin(absoluteParentPath, finalFileName);
                    fileNameToReturn = finalFileName;
                } else {
                    // Legacy VFS: Create filename with ordinal prefix
                    const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // 4-digit zero-padded
                    const newFileNameWithOrdinal = `${ordinalPrefix}_${finalFileName}`;
                    newFilePath = ifs.pathJoin(absoluteParentPath, newFileNameWithOrdinal);
                    fileNameToReturn = newFileNameWithOrdinal;
                }

                // Safety check: prevent overwriting existing files
                // If file already exists, try different random suffixes until we find a unique name
                while (await ifs.exists(newFilePath)) {
                    const randomSuffix = Math.floor(Math.random() * 100000);
                    const baseFileName = finalFileName.includes('.') 
                        ? finalFileName.substring(0, finalFileName.lastIndexOf('.'))
                        : finalFileName;
                    const extension = finalFileName.includes('.') 
                        ? finalFileName.substring(finalFileName.lastIndexOf('.'))
                        : '';
                    
                    const uniqueFileName = `${baseFileName}_${randomSuffix}${extension}`;
                    
                    if (fsType === 'vfs') {
                        // VFS2: No ordinal prefix in filename
                        newFilePath = ifs.pathJoin(absoluteParentPath, uniqueFileName);
                        fileNameToReturn = uniqueFileName;
                    } else {
                        // Legacy VFS: Create filename with ordinal prefix
                        const ordinalPrefix = insertOrdinal.toString().padStart(4, '0');
                        const newFileNameWithOrdinal = `${ordinalPrefix}_${uniqueFileName}`;
                        newFilePath = ifs.pathJoin(absoluteParentPath, newFileNameWithOrdinal);
                        fileNameToReturn = newFileNameWithOrdinal;
                    }
                }

                // Create the new file with empty content
                if (fsType === 'vfs' && 'writeFileEx' in ifs && ifs.writeFileEx.length >= 6) {
                    // VFS2: Pass ordinal as parameter to writeFileEx
                    await (ifs as any).writeFileEx(owner_id, newFilePath, '', 'utf8', info.node.is_public, insertOrdinal);
                } else {
                    // Legacy VFS: Use standard writeFileEx (ordinal is in filename)
                    await ifs.writeFileEx(owner_id, newFilePath, '', 'utf8', info.node.is_public);
                }
                //console.log(`File created successfully: ${newFilePath}`);
            
                // Send success response with the created filename
                res.json({ 
                    message: 'File created successfully',
                    fileName: fileNameToReturn 
                });
            } catch (error) {
                // Handle any errors during file creation
                handleError(error, res, 'Failed to create file');
                throw error;
            }
        });
    }

    /**
     * HTTP endpoint handler for creating new folders in the document tree with proper ordinal positioning.
     * 
     * This method creates new folders within the ordinal-based file system, automatically handling
     * ordinal assignment and ensuring proper positioning relative to existing folders and files.
     * Similar to file creation but specifically for directory structures.
     * 
     * Creation Process:
     * 1. Validate input parameters and document root access
     * 2. Determine insertion position based on insertAfterNode parameter
     * 3. Shift existing items down to make room for the new folder
     * 4. Create new folder with calculated ordinal prefix
     * 5. Use recursive directory creation for safety
     * 
     * Ordinal Management:
     * - If insertAfterNode specified: new folder gets (afterNode ordinal + 1)
     * - If no insertAfterNode: new folder gets ordinal 0 (top position)
     * - All affected files/folders are automatically renumbered to maintain sequence
     * 
     * Folder Naming Convention:
     * - Format: "NNNN_foldername" where NNNN is 4-digit zero-padded ordinal
     * - No file extension (folders don't have extensions)
     * 
     * @param req - Express request with body: {folderName, treeFolder, insertAfterNode, docRootKey}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created folder name or error
     */
    createFolder = async (req: Request<any, any, { folderName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (!owner_id) {
            throw new Error('Invalid owner_id: ' + owner_id);
        }

        await runTrans(async () => {
            console.log("Create Folder Request");
            try {
                // Extract parameters from request body
                const { treeFolder, insertAfterNode, docRootKey } = req.body;
                let {folderName} = req.body;
                folderName = fixName(folderName); // Ensure valid folder name
            
                // Get the appropriate file system implementation
                const ifs = docUtil.getFileSystem(docRootKey);
            
                // Resolve and validate document root
                const root = config.getPublicFolderByKey(docRootKey).path;
                if (!root) {
                    res.status(500).json({ error: 'bad key' });
                    return;
                }

                // Validate required parameters
                if (!folderName || !treeFolder) {
                    res.status(400).json({ error: 'Folder name and treeFolder are required' });
                    return;
                }

                // Construct absolute path to parent directory
                const absoluteParentPath = ifs.pathJoin(root, treeFolder);

                // Verify parent directory exists and is accessible
                const parentInfo: any = {};
                if (!await ifs.exists(absoluteParentPath, parentInfo)) {
                    res.status(404).json({ error: 'Parent directory not found' });
                    return;
                }

                // Calculate insertion ordinal based on insertAfterNode
                let insertOrdinal = 0; // Default: insert at top (ordinal 0)

                if (insertAfterNode && insertAfterNode.trim() !== '') {
                    console.log(`Create folder "${folderName}" below node: ${insertAfterNode}`);
                
                    // For VFS2: insertAfterNode is just the filename, we need to get its ordinal from the database
                    // For legacy VFS: insertAfterNode has ordinal prefix, extract it
                    const fsType = docUtil.getFileSystemType(docRootKey);
                    if (fsType === 'vfs') {
                        // VFS2: Get ordinal from database
                        const afterNodePath = ifs.pathJoin(absoluteParentPath, insertAfterNode);
                        const afterNodeInfo: any = {};
                        if (await ifs.exists(afterNodePath, afterNodeInfo) && afterNodeInfo.node) {
                            insertOrdinal = afterNodeInfo.node.ordinal + 1;
                        }
                    } else {
                        // Legacy VFS: Extract ordinal from filename prefix
                        const underscoreIndex = insertAfterNode.indexOf('_');
                        if (underscoreIndex !== -1) {
                            const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                            insertOrdinal = afterNodeOrdinal + 1; // Insert after the reference node
                        }
                    }
                } else {
                    console.log(`Create new top folder "${folderName}"`);
                }

                // Shift existing files/folders down to make room for the new folder
                // This ensures proper ordinal sequence is maintained
                await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root, null, ifs);

                // Determine the file system type to handle folder name creation differently
                const fsType = docUtil.getFileSystemType(docRootKey);
                let newFolderPath: string;
                let folderNameToReturn: string;
                
                if (fsType === 'vfs') {
                    // VFS2: No ordinal prefix in folder name, ordinal is stored in database
                    newFolderPath = ifs.pathJoin(absoluteParentPath, folderName);
                    folderNameToReturn = folderName;
                } else {
                    // Legacy VFS: Create folder name with ordinal prefix
                    const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // 4-digit zero-padded
                    const newFolderNameWithOrdinal = `${ordinalPrefix}_${folderName}`;
                    newFolderPath = ifs.pathJoin(absoluteParentPath, newFolderNameWithOrdinal);
                    folderNameToReturn = newFolderNameWithOrdinal;
                }

                // Create the directory (recursive option ensures parent directories exist, and we inherit `is_public` from parent.
                if (fsType === 'vfs' && 'mkdirEx' in ifs && ifs.mkdirEx.length >= 5) {
                    // VFS2: Pass ordinal as parameter to mkdirEx
                    await (ifs as any).mkdirEx(owner_id, newFolderPath, { recursive: true }, parentInfo.node.is_public, insertOrdinal);
                } else {
                    // Legacy VFS: Use standard mkdirEx (ordinal is in folder name)
                    // await ifs.mkdirEx(owner_id, newFolderPath, { recursive: true }, parentInfo.node.is_public);
                    throw new Error('mkdirEx with recursive not supported in legacy VFS');
                }

                console.log(`Folder created successfully: ${newFolderPath}`);
            
                // Send success response with the created folder name
                res.json({ 
                    message: 'Folder created successfully',
                    folderName: folderNameToReturn 
                });
            } catch (error) {
            // Handle any errors during folder creation
                handleError(error, res, 'Failed to create folder');
                throw error;
            }
        });
    }

    /**
     * HTTP endpoint for extracting hashtags from a ".TAGS.md" file in the document root.
     * 
     * This endpoint searches for a file named ".TAGS.md" in the root of the specified document root
     * and extracts all hashtags from it using regex pattern matching. The tags are returned as a
     * sorted array of unique tag strings.
     * 
     * @param req - Express request with docRootKey parameter
     * @param res - Express response to send the extracted tags
     */
    extractTags = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const docRootKey = req.params.docRootKey;
            const ifs = docUtil.getFileSystem(docRootKey);
            const owner_id = svrUtil.getOwnerId(req, res);
            if (owner_id == null) {
                return;
            }
            
            // Get the root path for the document root
            const root = config.getPublicFolderByKey(docRootKey);
            if (!root) {
                res.json({
                    success: false,
                    message: 'Invalid document root key',
                    tags: []
                });
                return;
            }

            try {
                // Try to read .TAGS.md from the root directory
                const tagsFilePath = ifs.pathJoin(root.path, '.TAGS.md');
                
                const fileContent = await ifs.readFile(owner_id, tagsFilePath, 'utf8') as string;
                
                console.log('Read .TAGS.md file content:', fileContent); // Debug logging
                
                // Parse tags with categories
                const categories = this.parseTagsWithCategories(fileContent);
                
                // Extract flat list of tags for backward compatibility
                const allTags: string[] = [];
                categories.forEach(category => {
                    allTags.push(...category.tags);
                });
                const uniqueTags = [...new Set(allTags)].sort();
                
                res.json({
                    success: true,
                    tags: uniqueTags, // Backward compatibility
                    categories: categories // New categorized format
                });
                
            } catch {
                // If .TAGS.md doesn't exist or can't be read, return empty arrays
                console.log('.TAGS.md not found or not readable, returning empty tags list');
                res.json({
                    success: true,
                    tags: [],
                    categories: []
                });
            }
            
        } catch (error) {
            handleError(error, res, 'Failed to extract tags');
        }
    }

    /**
     * HTTP endpoint for scanning all markdown files and updating the .TAGS.md file with newly discovered hashtags.
     * 
     * This endpoint performs a two-phase scan:
     * 1. Phase 1: Load existing tags from .TAGS.md into a hash map
     * 2. Phase 2: Scan all markdown files in the document root for hashtags
     * 3. Compare and append any new tags to .TAGS.md if new ones are found
     * 
     * @param req - Express request with docRootKey parameter
     * @param res - Express response with scan results
     */
    scanAndUpdateTags = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const docRootKey = req.params.docRootKey;
            const ifs = docUtil.getFileSystem(docRootKey);
            const owner_id = svrUtil.getOwnerId(req, res);
            if (owner_id == null) {
                return;
            }
            
            // Get the root path for the document root
            const root = config.getPublicFolderByKey(docRootKey);
            if (!root) {
                res.json({
                    success: false,
                    message: 'Invalid document root key',
                    existingTags: 0,
                    newTags: 0,
                    totalTags: 0
                });
                return;
            }

            console.log(`Starting tag scan for document root: ${root.path}`);

            // Phase 1: Load existing tags from .TAGS.md
            const tagsFilePath = ifs.pathJoin(root.path, '.TAGS.md');
            const existingTagsMap = new Map<string, boolean>();
            let existingContent = '';
            
            try {
                existingContent = await ifs.readFile(owner_id, tagsFilePath, 'utf8') as string;
                const existingTags = this.extractHashtagsFromText(existingContent);
                
                existingTags.forEach(tag => {
                    existingTagsMap.set(tag, true);
                });
                
                console.log(`Found ${existingTags.length} existing tags in .TAGS.md`);
            } catch {
                console.log('.TAGS.md not found, starting with empty tag set');
            }

            // Phase 2: Scan all markdown files for hashtags
            const newTagsMap = new Map<string, boolean>();
            await this.scanDirectoryForTags(owner_id, root.path, root.path, ifs, existingTagsMap, newTagsMap);

            const newTagsArray = Array.from(newTagsMap.keys()).sort();
            console.log(`Found ${newTagsArray.length} new tags during scan`);

            // Phase 3: Update .TAGS.md if new tags were found
            if (newTagsArray.length > 0) {
                let updatedContent = existingContent;
                
                // If there's existing content, add a newline before the new section
                if (existingContent && !existingContent.endsWith('\n')) {
                    updatedContent += '\n';
                }
                
                // Add new tags under a "Discovered Tags" heading
                if (existingContent) {
                    updatedContent += '\n## Discovered Tags\n';
                } else {
                    updatedContent = '## Discovered Tags\n';
                }
                updatedContent += newTagsArray.join(' ') + '\n';
                
                try {
                    await ifs.writeFile(owner_id, tagsFilePath, updatedContent, 'utf8');
                    console.log(`Updated .TAGS.md with ${newTagsArray.length} new tags under "Discovered Tags" section`);
                } catch (error) {
                    console.error('Failed to write updated .TAGS.md:', error);
                    res.json({
                        success: false,
                        message: 'Failed to update .TAGS.md file',
                        existingTags: existingTagsMap.size,
                        newTags: newTagsArray.length,
                        totalTags: existingTagsMap.size + newTagsArray.length
                    });
                    return;
                }
            }

            // Clear the module-level cache so the TagSelector will reload
            // Note: This is handled on the client side by invalidating the cache

            res.json({
                success: true,
                message: newTagsArray.length > 0 ? 
                    `Scan completed. Added ${newTagsArray.length} new tags.` : 
                    'Scan completed. No new tags found.',
                existingTags: existingTagsMap.size,
                newTags: newTagsArray.length,
                totalTags: existingTagsMap.size + newTagsArray.length
            });
            
        } catch (error) {
            handleError(error, res, 'Failed to scan and update tags');
        }
    }

    /**
     * Recursively scans a directory for markdown files and extracts hashtags.
     * 
     * @param owner_id - The owner ID for file access
     * @param currentPath - Current directory path being scanned
     * @param rootPath - Root path for security validation
     * @param ifs - File system interface
     * @param existingTags - Map of existing tags to avoid duplicates
     * @param newTags - Map to collect newly discovered tags
     */
    private async scanDirectoryForTags(
        owner_id: number,
        currentPath: string,
        rootPath: string,
        ifs: IFS,
        existingTags: Map<string, boolean>,
        newTags: Map<string, boolean>
    ): Promise<void> {
        try {
            const items = await ifs.readdirEx(owner_id, currentPath, true);
            
            for (const item of items) {
                // Skip hidden files and system files
                if (item.name.startsWith('.') || item.name.startsWith('_')) {
                    continue;
                }
                
                const itemPath = ifs.pathJoin(currentPath, item.name);
                
                if (item.is_directory) {
                    // Recursively scan subdirectories
                    await this.scanDirectoryForTags(owner_id, itemPath, rootPath, ifs, existingTags, newTags);
                } else if (item.name.toLowerCase().endsWith('.md') || item.name.toLowerCase().endsWith('.txt')) {
                    // Process markdown and text files
                    try {
                        const fileContent = await ifs.readFile(owner_id, itemPath, 'utf8') as string;
                        const fileTags = this.extractHashtagsFromText(fileContent);
                        
                        // Add any new tags to the newTags map
                        fileTags.forEach(tag => {
                            if (!existingTags.has(tag) && !newTags.has(tag)) {
                                newTags.set(tag, true);
                            }
                        });
                    } catch (error) {
                        console.warn(`Failed to read file ${itemPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to scan directory ${currentPath}:`, error);
        }
    }

    /**
     * Parses the .TAGS.md file to extract categorized tags organized under markdown headings.
     * 
     * This method processes the file line by line, treating any markdown heading (any number of #)
     * as a category header. All hashtags found after a heading are considered to belong to that
     * category until the next heading is encountered.
     * 
     * @param text - The content of the .TAGS.md file
     * @returns Array of TagCategory objects with heading and associated tags
     */
    private parseTagsWithCategories(text: string): { heading: string; tags: string[] }[] {
        const lines = text.split('\n');
        const categories: { heading: string; tags: string[] }[] = [];
        let currentHeading = '';
        let currentTags: string[] = [];
        
        // Regex patterns
        const headingRegex = /^#+\s+(.+)$/; // Matches markdown heading (# followed by space)
        const hashtagRegex = /(?:^|[\s\n])#[a-zA-Z0-9_/-]+/g; // Same pattern as extractHashtagsFromText
        
        console.log('Parsing .TAGS.md content, total lines:', lines.length); // Debug
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (!trimmedLine) {
                continue;
            }
            
            // console.log('Processing line:', JSON.stringify(trimmedLine)); // Debug
            
            // Check if this line is a markdown heading
            const headingMatch = trimmedLine.match(headingRegex);
            if (headingMatch) {
                console.log('Found heading match:', headingMatch[1]); // Debug
                
                // If we have a previous category with tags, save it
                if (currentHeading && currentTags.length > 0) {
                    console.log('Saving previous category:', currentHeading, 'with tags:', currentTags); // Debug
                    categories.push({
                        heading: currentHeading,
                        tags: [...new Set(currentTags)].sort() // Remove duplicates and sort
                    });
                }
                
                // Start a new category
                currentHeading = headingMatch[1].trim();
                currentTags = [];
                // console.log('Started new category:', currentHeading); // Debug
            } else {
                // This line is not a heading, extract hashtags from it
                const rawMatches = trimmedLine.match(hashtagRegex) || [];
                // Extract just the hashtag part (remove any leading whitespace)
                const tagsInLine = rawMatches.map(match => {
                    const hashIndex = match.indexOf('#');
                    return match.substring(hashIndex);
                });
                // console.log('Found tags in line:', tagsInLine); // Debug
                currentTags.push(...tagsInLine);
            }
        }
        
        // Don't forget the last category
        if (currentHeading && currentTags.length > 0) {
            console.log('Saving final category:', currentHeading, 'with tags:', currentTags); // Debug
            categories.push({
                heading: currentHeading,
                tags: [...new Set(currentTags)].sort() // Remove duplicates and sort
            });
        }
        
        // If no headings were found but we have tags, create a default category
        if (categories.length === 0 && currentTags.length > 0) {
            console.log('No headings found, creating General category with tags:', currentTags); // Debug
            categories.push({
                heading: 'General',
                tags: [...new Set(currentTags)].sort()
            });
        }
        
        console.log('Final parsed categories from .TAGS.md:', JSON.stringify(categories, null, 2)); // Debug logging
        
        return categories;
    }

    /**
     * Extracts hashtags from text content using regex pattern matching.
     * 
     * Searches for patterns like "#tagname" where tagname consists of letters, numbers, 
     * underscores, and hyphens. Only matches hashtags that are properly standalone - either
     * at the beginning of the text, at the beginning of a line, or preceded by whitespace.
     * 
     * @param text - The text content to search for hashtags
     * @returns Array of unique hashtags sorted alphabetically
     */
    private extractHashtagsFromText(text: string): string[] {
        // Regex to match hashtags: # preceded by start of string, newline, or whitespace
        // followed by word characters, underscores, hyphens, and forward slashes
        const hashtagRegex = /(?:^|[\s\n])#[a-zA-Z0-9_/-]+/g;
        
        const matches = text.match(hashtagRegex) || [];
        
        // Extract just the hashtag part (remove any leading whitespace)
        const cleanedMatches = matches.map(match => {
            // Find the # character and extract from there
            const hashIndex = match.indexOf('#');
            return match.substring(hashIndex);
        });
        
        // Convert to Set to remove duplicates, then back to Array and sort
        const uniqueTags = Array.from(new Set(cleanedMatches));
        
        return uniqueTags.sort();
    }
}

export const docSvc = new DocService();
