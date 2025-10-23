import vfs from './VFS/VFS.js';

/**
 * Utility class for document management operations including file/folder ordering,
 * security validation, and file system integration.
 * 
 * This class provides functionality for:
 * - Managing ordinal-based file/folder naming (NNNN_filename format)
 * - Shifting ordinals to maintain proper sequencing during insertions
 * - Security validation to prevent directory traversal attacks
 * - File system integration for opening files/folders in desktop applications
 * 
 * All methods that access the file system include security checks to ensure
 * operations are restricted to allowed root directories.
 */
class DocUtil {
    getPathByUUID = async (uuid: string): Promise<string | null> => {       
        const result = await vfs.getItemByID(uuid);
        if (result.node) {
            // console.log(`Found VFS item by UUID: ${uuid} -> docPath: ${result.docPath}`);
            return result.docPath;
                           
        } else {
            console.log(`VFS item not found for UUID: ${uuid}`);
        }
        return null;
    }
    
    /**
     * Shifts ordinals down for all files/folders at or below a given ordinal position
     * 
     * This method creates space for new files to be inserted at specific positions by
     * incrementing the ordinal values. For VFS, this is done efficiently in the database
     * by updating the ordinal column directly. For legacy VFS, it renames files with
     * ordinal prefixes.
     * 
     * Process for VFS:
     * 1. Uses database function to increment ordinal values directly
     * 2. Returns mapping (filenames don't change, only ordinals)
     * 
     * Process for legacy VFS:
     * 1. Reads directory contents and filters for ordinal-prefixed items
     * 2. Identifies items that need shifting (ordinal >= insertOrdinal)
     * 3. Sorts in reverse order to avoid naming conflicts during renaming
     * 4. Increments each ordinal by the specified amount
     * 5. Tracks path mappings for external systems that reference these files
     * 
     * @param slotsToAdd - Number of ordinal slots to add (shift amount)
     * @param absoluteParentPath - The absolute path to the directory containing items to shift
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and below get shifted)
     * @param root - The root directory for security validation
     * @param itemsToIgnore - Array of filenames to skip during shifting (optional, useful for newly created items)
     * @returns Map of old relative paths to new relative paths for renamed items
     */
    shiftOrdinalsDown = async (owner_id: number, slotsToAdd: number, absoluteParentPath: string, insertOrdinal: number, root: string): Promise<Map<string, string>> => {
        // console.log(`Shifting ordinals down by ${slotsToAdd} slots at ${absoluteParentPath} for insert ordinal ${insertOrdinal}`);
        
        console.log(`Using VFS database-based ordinal shifting for ${slotsToAdd} slots at ${absoluteParentPath}`);
            
        // VFS's shiftOrdinalsDown already normalizes the path, so we can pass it directly
        // It expects the full path (which will be normalized to remove leading slashes)
        // Note: root parameter kept for API compatibility but not used in VFS implementation
        return await vfs.shiftOrdinalsDown(owner_id, absoluteParentPath, insertOrdinal, slotsToAdd);
    } 
    
    /**
     * Parses a search query string into individual search terms, handling quoted phrases and unquoted words.
     * 
     * This utility method extracts search terms from a query string, properly handling:
     * - Quoted phrases: "exact phrase" - treated as single search terms
     * - Unquoted words: individual words separated by whitespace
     * - Mixed queries: combination of quoted phrases and unquoted words
     * 
     * The parsing preserves the integrity of quoted phrases while splitting unquoted text
     * by whitespace. This is essential for search functionality that needs to distinguish
     * between exact phrase matches and individual word matches.
     * 
     * Examples:
     * - 'hello world' → ['hello', 'world']
     * - '"hello world"' → ['hello world']
     * - 'hello "exact phrase" world' → ['hello', 'exact phrase', 'world']
     * 
     * @param query - The search query string to parse
     * @returns Array of search terms, with quoted phrases preserved as single terms
     */
    parseSearchTerms = (query: string): string[] => {
        const searchTerms: string[] = [];
        
        // Handle quoted phrases and individual words
        if (query.includes('"')) {
            // Extract quoted phrases and unquoted words using regex
            const regex = /"([^"]+)"|(\S+)/g;
            let match;
            while ((match = regex.exec(query)) !== null) {
                if (match[1]) {
                    searchTerms.push(match[1]); // Quoted phrase
                } else if (match[2] && !match[2].startsWith('"')) {
                    searchTerms.push(match[2]); // Unquoted word
                }
            }
        } else {
            // Split by whitespace for simple queries
            searchTerms.push(...query.trim().split(/\s+/).filter(term => term.length > 0));
        }
        
        return searchTerms;
    }
}

export const docUtil = new DocUtil();