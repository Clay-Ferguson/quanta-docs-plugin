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
