import { TreeNode } from "../../../../common/types/CommonTypes.js";
import { svrUtil } from "../../../../server/ServerUtil.js";

/**
 * Determine if a file is binary based on its extension
 */
export function isBinaryFile(ext: string): boolean {
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
export function getContentType(ext: string): string {
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
    
/**
 * Parse a full path to extract parent path and filename
 * @param fullPath - The full absolute path 
 * @returns Object with parentPath and filename
 */
export function parsePath(fullPath: string): { parentPath: string; filename: string } {
    const normalizedPath = normalizePath(fullPath);

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

export function convertToTreeNode(row: any): TreeNode | null {
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

/* NOTE: VFS requires there be NO leading slashes on paths */
export function normalizePath(fullPath: string): string {
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

export function pathJoin(...parts: string[]): string {
    return normalizePath(parts.join('/'));
}
    
// Split 'fullPath' by '/' and then run 'validName' on each part or if there's no '/' just run 'validName' on the fullPath
export function validPath(fullPath: string): boolean {
    // Normalize the path to ensure consistent formatting
    fullPath = normalizePath(fullPath);

    // Split the path by '/' and check each part
    const parts = fullPath.split('/');
    for (const part of parts) {
        if (!svrUtil.validName(part)) {
            return false; // If any part is invalid, return false
        }
    }
    return true; // All parts are valid
}