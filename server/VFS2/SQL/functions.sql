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

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_write_text_file
-- Equivalent to fs.writeFileSync() for text files - writes text file content
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is required and controls the positional ordering within the parent directory
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_write_text_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data TEXT,
    root_key TEXT,
    ordinal_param INTEGER,
    content_type_param TEXT DEFAULT 'text/plain',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
BEGIN
    file_size := LENGTH(content_data);
    
    INSERT INTO vfs2_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        filename_param,
        ordinal_param,
        FALSE,
        content_data,
        NULL,
        FALSE,
        content_type_param,
        file_size,
        NOW(),
        NOW(),
        is_public_param
    )
    ON CONFLICT (doc_root_key, parent_path, filename)
    DO UPDATE SET 
        content_text = content_data,
        content_binary = NULL,
        is_binary = FALSE,
        content_type = content_type_param,
        size_bytes = file_size,
        ordinal = ordinal_param,
        is_public = is_public_param,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_write_binary_file
-- Equivalent to fs.writeFileSync() for binary files - writes binary file content
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is required and controls the positional ordering within the parent directory
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_write_binary_file(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    content_data BYTEA,
    root_key TEXT,
    ordinal_param INTEGER,
    content_type_param TEXT DEFAULT 'application/octet-stream',
    is_public_param BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    file_id INTEGER;
    file_size BIGINT;
BEGIN
    file_size := LENGTH(content_data);
    
    INSERT INTO vfs2_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        filename_param,
        ordinal_param,
        FALSE,
        NULL,
        content_data,
        TRUE,
        content_type_param,
        file_size,
        NOW(),
        NOW(),
        is_public_param
    )
    ON CONFLICT (doc_root_key, parent_path, filename)
    DO UPDATE SET 
        content_text = NULL,
        content_binary = content_data,
        is_binary = TRUE,
        content_type = content_type_param,
        size_bytes = file_size,
        ordinal = ordinal_param,
        is_public = is_public_param,
        modified_time = NOW()
    RETURNING id INTO file_id;
    
    RETURN file_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_exists
-- Equivalent to fs.existsSync() - checks if file or directory exists
-- Uses vfs2_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_exists(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    exists_flag BOOLEAN;
BEGIN
    SELECT COUNT(*) > 0
    INTO exists_flag
    FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param;
        
        RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_get_node_by_name 
-- Similar to vfs2_exists but returns the entire node row if found, or null if not found
-- Uses vfs2_nodes table and includes ordinal column (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_get_node_by_name(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    id INTEGER,
    uuid UUID,
    owner_id INTEGER,
    doc_root_key VARCHAR(255),
    parent_path TEXT,
    filename VARCHAR(255),
    ordinal INTEGER,
    is_directory BOOLEAN,
    content_text TEXT,
    content_binary BYTEA,
    is_binary BOOLEAN,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.uuid,
        n.owner_id,
        n.doc_root_key,
        n.parent_path,
        n.filename,
        n.ordinal,
        n.is_directory,
        n.content_text,
        n.content_binary,
        n.is_binary,
        n.content_type,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.is_public
    FROM vfs2_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_stat
-- Equivalent to fs.statSync() - gets file/directory metadata
-- Uses vfs2_nodes table and includes ordinal column (key difference from VFS)
-- Returns file/directory metadata including ordinal information
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_stat(
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS TABLE(
    is_public BOOLEAN,
    is_directory BOOLEAN,
    size_bytes BIGINT,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(100),
    ordinal INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.is_public,
        n.is_directory,
        n.size_bytes,
        n.created_time,
        n.modified_time,
        n.content_type,
        n.ordinal
    FROM vfs2_nodes n
    WHERE 
        n.doc_root_key = root_key
        AND n.parent_path = parent_path_param
        AND n.filename = filename_param;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_unlink
-- Equivalent to fs.unlinkSync() - deletes a file
-- Uses vfs2_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_unlink(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND is_directory = FALSE
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg);
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'File not found: %/%', parent_path_param, filename_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_children_exist
-- Checks if a directory has any children (files or folders)
-- Returns true if the specified path has any files or folders in it
-- Used to determine if a directory is empty
-- Uses vfs2_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_children_exist(
    owner_id_arg INTEGER,
    path_param TEXT,
    root_key TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    has_children BOOLEAN;
BEGIN
    SELECT COUNT(*) > 0
    INTO has_children
    FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = path_param
        AND (owner_id_arg = 0 OR owner_id = owner_id_arg OR is_public = TRUE);
        
    RETURN has_children;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DIRECTORY OPERATIONS
-- ==============================================================================

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_mkdir
-- Equivalent to fs.mkdirSync() - creates a directory
-- Uses ordinal column directly instead of filename prefix management (key difference from VFS)
-- Ordinal parameter is required and controls the positional ordering within the parent directory
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_mkdir(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT,
    ordinal_param INTEGER,
    recursive_flag BOOLEAN DEFAULT FALSE,
    is_public_arg BOOLEAN DEFAULT FALSE
) 
RETURNS INTEGER AS $$
DECLARE
    dir_id INTEGER;
BEGIN
    -- Check if directory already exists
    IF vfs2_exists(parent_path_param, dirname_param, root_key) THEN
        RAISE EXCEPTION 'Directory already exists: %/%', parent_path_param, dirname_param;
    END IF;
    
    -- Create the directory
    INSERT INTO vfs2_nodes (
        owner_id,
        doc_root_key,
        parent_path,
        filename,
        ordinal,
        is_directory,
        content_text,
        content_binary,
        is_binary,
        content_type,
        size_bytes,
        created_time,
        modified_time,
        is_public
    ) VALUES (
        owner_id_arg,
        root_key,
        parent_path_param,
        dirname_param,
        ordinal_param,
        TRUE,
        NULL,
        NULL,
        FALSE,
        'directory',
        0,
        NOW(),
        NOW(),
        is_public_arg
    ) RETURNING id INTO dir_id;
    
    RETURN dir_id;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_rmdir
-- Equivalent to fs.rmSync() - removes a directory recursively
-- Uses vfs2_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_rmdir(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    dirname_param TEXT,
    root_key TEXT
) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    dir_path TEXT;
BEGIN
    -- Build the full path of the directory to delete
    -- Handle empty string (root) vs non-empty parent paths
    IF parent_path_param = '' THEN
        dir_path := dirname_param;
    ELSE
        dir_path := parent_path_param || '/' || dirname_param;
    END IF;
    
    -- Check if directory exists
    IF NOT vfs2_exists(parent_path_param, dirname_param, root_key) THEN
        RAISE EXCEPTION 'Directory not found: %s/%s', parent_path_param, dirname_param;
    END IF;
    
    -- Check authorization
    IF NOT vfs2_check_auth(owner_id_arg, parent_path_param, dirname_param, root_key, TRUE) THEN
        RAISE EXCEPTION 'Not authorized to remove directory: %s/%s', parent_path_param, dirname_param;
    END IF;
    
    -- Delete all children recursively first (using a simpler approach)
    -- Delete all descendants where parent_path starts with our directory path
    DELETE FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND (
            parent_path = dir_path OR 
            parent_path LIKE dir_path || '/%'
        );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete the directory itself
    DELETE FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = dirname_param
        AND is_directory = TRUE;
        
    -- Add the directory itself to the count
    deleted_count := deleted_count + 1;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------------------------------------
-- Function: vfs2_check_auth
-- Checks if a user is authorized to access/modify a file or directory
-- Returns true if:
-- 1. User is the owner of the file/folder
-- 2. User has admin privileges (owner_id_arg = 0)
-- Uses vfs2_nodes table instead of vfs_nodes (key difference from VFS)
-----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vfs2_check_auth(
    owner_id_arg INTEGER,
    parent_path_param TEXT,
    filename_param TEXT,
    root_key TEXT,
    is_directory_param BOOLEAN DEFAULT NULL
) 
RETURNS BOOLEAN AS $$
DECLARE
    item_owner_id INTEGER;
    item_exists BOOLEAN;
    item_is_directory BOOLEAN;
BEGIN
    -- Check if the item exists and get its owner_id
    SELECT 
        owner_id, 
        TRUE, 
        is_directory
    INTO 
        item_owner_id, 
        item_exists, 
        item_is_directory
    FROM vfs2_nodes
    WHERE 
        doc_root_key = root_key
        AND parent_path = parent_path_param
        AND filename = filename_param
        AND (is_directory_param IS NULL OR is_directory = is_directory_param);
    
    -- Item doesn't exist
    IF item_exists IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Admin always has access
    IF owner_id_arg = 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is the owner
    RETURN item_owner_id = owner_id_arg;
END;
$$ LANGUAGE plpgsql;