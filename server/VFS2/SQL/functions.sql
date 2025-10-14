-- PostgreSQL Functions for VFS2 Document Filesystem
-- This file contains all PostgreSQL stored procedures for the VFS2 filesystem abstraction

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_readdir
-- Equivalent to fs.readdirSync() - lists directory contents
-- Returns files/folders in ordinal order with their metadata
-- Uses the ordinal column instead of filename prefix for ordering (key difference from VFS)
-- Optional include_content parameter includes content_text column when true
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_readdir(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT,
    include_content BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    ordinal INTEGER,
    content_text TEXT
) AS $$
BEGIN
    IF include_content THEN
        RETURN QUERY
        SELECT 
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            n.ordinal,
            n.content_text
        FROM vfs2_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.ordinal ASC, n.filename ASC;
    ELSE
        RETURN QUERY
        SELECT 
            n.owner_id,
            n.is_public,
            n.filename,
            n.is_directory,
            n.size_bytes,
            n.content_type,
            n.created_time,
            n.modified_time,
            n.ordinal,
            NULL::TEXT as content_text
        FROM vfs2_nodes n
        WHERE 
            n.doc_root_key = root_key 
            AND n.parent_path = dir_path
            AND (owner_id_arg=0 OR n.owner_id = owner_id_arg OR n.is_public = TRUE) 
        ORDER BY 
            n.ordinal ASC, n.filename ASC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_readdir_by_owner
-- Finds all files/folders in the specified path owned by the specified owner
-- Returns files/folders in ordinal order with their metadata
-- Uses the ordinal column instead of filename prefix for ordering (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_readdir_by_owner(
    owner_id_arg INTEGER,
    dir_path TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    owner_id INTEGER,
    is_public BOOLEAN,
    filename VARCHAR(255),
    is_directory BOOLEAN,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    ordinal INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.owner_id,
        n.is_public,
        n.filename,
        n.is_directory,
        n.size_bytes,
        n.content_type,
        n.created_time,
        n.modified_time,
        n.ordinal
    FROM vfs2_nodes n
    WHERE 
        n.doc_root_key = root_key 
        AND n.parent_path = dir_path
        AND n.owner_id = owner_id_arg 
    ORDER BY 
        n.ordinal ASC, n.filename ASC;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_get_max_ordinal
-- Equivalent to DocUtil.getMaxOrdinal() - finds highest ordinal in a directory
-- Uses the ordinal column directly instead of parsing filename prefixes (key difference from VFS)
-- Returns the maximum ordinal value from direct children in the given path
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_get_max_ordinal(
    parent_path_arg TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    max_ord INTEGER;
BEGIN
    SELECT COALESCE(MAX(ordinal), 0)
    INTO max_ord
    FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_arg;
        
    RETURN max_ord;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- BASIC FILE OPERATIONS
-- ==============================================================================

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_read_file
-- Equivalent to fs.readFileSync() - reads file content (both text and binary)
-- Returns BYTEA for compatibility, but content comes from appropriate column
-- Uses direct filename matching instead of ordinal prefix parsing (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_read_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BYTEA AS $$
DECLARE
    file_content BYTEA;
    text_content TEXT;
    is_binary_file BOOLEAN;
BEGIN
    SELECT is_binary, content_text, content_binary
    INTO is_binary_file, text_content, file_content
    FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg OR is_public = TRUE); 
        
    -- Check if file was found
    IF is_binary_file IS NULL THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    -- Return appropriate content based on file type
    IF is_binary_file THEN
        RETURN file_content;
    ELSE
        -- Convert text to BYTEA for return
        RETURN convert_to(text_content, 'UTF8');
    END IF;
END;
$$ LANGUAGE plpgsql;
