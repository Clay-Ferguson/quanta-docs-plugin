import pgdb from '../../../../../server/db/PGDB.js';
import { TestRunner } from '../../../../../common/TestRunner.js';

const testRootKey = 'usr';

export async function runTests() {
    console.log("🚀 Starting VFS2 embedded tests...");
    
    // Check if database is available
    if (!pgdb.adminProfile?.id) {
        console.log("⚠️  Database not available - skipping VFS2 tests");
        return;
    }
    
    const owner_id = pgdb.adminProfile.id;
    console.log(`🔧 Running VFS2 tests with owner_id: ${owner_id}`);
    
    const testRunner = new TestRunner("VFS2");
    
    try {
        // Run the simple read/write test using the test runner
        await testRunner.run("simpleReadWriteTest", () => simpleReadWriteTest(owner_id), true);
        
        // Run the readdir test using the test runner
        await testRunner.run("readdirTest", () => readdirTest(owner_id), true);
        
        // Run the readdir_by_owner test using the test runner
        await testRunner.run("readdirByOwnerTest", () => readdirByOwnerTest(owner_id), true);
        
        console.log("✅ VFS2 test suite passed");
    } catch {
        console.error("❌ VFS2 test suite failed");
    }
    finally {
        testRunner.report();
    }
}

export async function simpleReadWriteTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 Simple Read/Write Test Starting ===');

        const testParentPath = '/test-documents';
        const testFilename = 'test-file.md';  // VFS2 doesn't require ordinal prefixes
        const testContent = 'This is a test file created by the VFS2 test function.';
        const testContentType = 'text/markdown';
        const testOrdinal = 1000;  // Use ordinal column directly

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);

        console.log('Creating test record in VFS2...');
        
        // Insert a test file record directly into VFS2 table
        // Note: This is a direct database insert for testing purposes
        // In the actual implementation, we would use VFS2 SQL functions
        const params = [
            owner_id, 
            testRootKey, 
            testParentPath, 
            testFilename, 
            testOrdinal,
            false,  // is_directory
            false,  // is_public
            testContent,  // content_text
            null,  // content_binary
            false,  // is_binary
            testContentType,  // content_type
            Buffer.from(testContent).length  // size_bytes
        ];
        
        console.log(`Executing INSERT with ${params.length} parameters:`, params);
        
        const result = await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, ...params);
        
        const fileId = result.rows[0].id;
        const fileUuid = result.rows[0].uuid;
        console.log(`Test file created with ID: ${fileId}, UUID: ${fileUuid}`);

        // Now read the record back
        console.log('Reading test record back from VFS2...');
        
        const readResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_binary, 
                   created_time, modified_time, is_directory
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testFilename);
        
        if (readResult.rows.length === 0) {
            throw new Error('Test file not found after creation');
        }

        const retrievedData = readResult.rows[0];
        const retrievedContent = retrievedData.content_text;
        
        console.log('Retrieved content:', retrievedContent);
        console.log('File metadata:', {
            is_directory: retrievedData.is_directory,
            is_binary: retrievedData.is_binary,
            size_bytes: retrievedData.size_bytes,
            content_type: retrievedData.content_type,
            ordinal: retrievedData.ordinal,
            created_time: retrievedData.created_time,
            modified_time: retrievedData.modified_time
        });

        // Verify content matches
        if (retrievedContent !== testContent) {
            throw new Error(`Content mismatch! Expected: "${testContent}", Got: "${retrievedContent}"`);
        }

        // Test directory listing by ordinal
        console.log('Testing directory listing ordered by ordinal...');
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} items in directory ${testParentPath}:`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        // Clean up test data
        console.log('Cleaning up test data...');
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testFilename);

        console.log('=== VFS2 Simple Read/Write Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Simple Read/Write Test Failed ===');
        console.error('Error during VFS2 test:', error);
        throw error;
    }
}

export async function readdirTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 Readdir Test Starting ===');

        const testParentPath = '/test-readdir';
        
        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        const testFiles = [
            { filename: 'file-c.txt', ordinal: 3000, content: 'Content C' },
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-b.txt', ordinal: 2000, content: 'Content B' },
            { filename: 'dir-d', ordinal: 4000, isDirectory: true },
        ];

        console.log('Creating test files with different ordinals...');
        
        // Insert test files/directories with different ordinal values
        for (const testFile of testFiles) {
            const params = [
                owner_id, 
                testRootKey, 
                testParentPath, 
                testFile.filename, 
                testFile.ordinal,
                testFile.isDirectory || false,  // is_directory
                false,  // is_public
                testFile.isDirectory ? null : testFile.content,  // content_text (null for directories)
                null,  // content_binary
                false,  // is_binary
                testFile.isDirectory ? 'directory' : 'text/plain',  // content_type
                testFile.isDirectory ? 0 : Buffer.from(testFile.content!).length  // size_bytes
            ];
            
            await pgdb.query(`
                INSERT INTO vfs2_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, ...params);
            
            console.log(`Created ${testFile.isDirectory ? 'directory' : 'file'}: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }

        // Now test the vfs2_readdir function
        console.log('Testing vfs2_readdir function...');
        
        const readdirResult = await pgdb.query(`
            SELECT * FROM vfs2_readdir($1, $2, $3, $4)
        `, owner_id, testParentPath, testRootKey, false);  // false = don't include content
        
        console.log(`vfs2_readdir returned ${readdirResult.rows.length} items:`);
        
        // Verify the results are ordered by ordinal
        const expectedOrder = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d'];
        const actualOrder = readdirResult.rows.map((row: any) => row.filename);
        
        console.log('Expected order:', expectedOrder);
        console.log('Actual order:  ', actualOrder);
        
        // Check each item in the results
        readdirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        // Verify the ordering is correct
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        // Test with include_content = true
        console.log('Testing vfs2_readdir with include_content=true...');
        
        const readdirWithContentResult = await pgdb.query(`
            SELECT * FROM vfs2_readdir($1, $2, $3, $4)
        `, owner_id, testParentPath, testRootKey, true);  // true = include content
        
        // Verify content is included for files but not directories
        const fileWithContent = readdirWithContentResult.rows.find((row: any) => row.filename === 'file-a.txt');
        const directoryRow = readdirWithContentResult.rows.find((row: any) => row.filename === 'dir-d');
        
        if (fileWithContent?.content_text !== 'Content A') {
            throw new Error(`Expected content 'Content A' for file-a.txt, got: ${fileWithContent?.content_text}`);
        }
        
        if (directoryRow?.content_text !== null) {
            throw new Error(`Expected null content for directory dir-d, got: ${directoryRow?.content_text}`);
        }

        console.log('✅ Content inclusion test passed');

        // Clean up test data
        console.log('Cleaning up test data...');
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);

        console.log('=== VFS2 Readdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Readdir Test Failed ===');
        console.error('Error during VFS2 readdir test:', error);
        throw error;
    }
}

export async function readdirByOwnerTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-readdir-by-owner';
    
    try {
        console.log('=== VFS2 Readdir By Owner Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Create test files all owned by the same user
        // We'll test the owner filtering by creating files and then using a non-existent owner ID
        // to verify that vfs2_readdir_by_owner properly filters by owner
        
        const testFiles = [
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-b.txt', ordinal: 2000, content: 'Content B' },
            { filename: 'file-c.txt', ordinal: 3000, content: 'Content C' },
            { filename: 'dir-d', ordinal: 4000, isDirectory: true },
            { filename: 'dir-e', ordinal: 5000, isDirectory: true },
        ];

        console.log('Creating test files with the current owner...');
        
        // Insert test files/directories all owned by the current owner
        for (const testFile of testFiles) {
            const params = [
                owner_id, 
                testRootKey, 
                testParentPath, 
                testFile.filename, 
                testFile.ordinal,
                testFile.isDirectory || false,  // is_directory
                false,  // is_public
                testFile.isDirectory ? null : testFile.content,  // content_text (null for directories)
                null,  // content_binary
                false,  // is_binary
                testFile.isDirectory ? 'directory' : 'text/plain',  // content_type
                testFile.isDirectory ? 0 : Buffer.from(testFile.content!).length  // size_bytes
            ];
            
            await pgdb.query(`
                INSERT INTO vfs2_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, ...params);
            
            console.log(`Created ${testFile.isDirectory ? 'directory' : 'file'}: ${testFile.filename} (ordinal: ${testFile.ordinal}, owner: ${owner_id})`);
        }

        // Test the vfs2_readdir_by_owner function for the correct owner
        console.log(`Testing vfs2_readdir_by_owner function for correct owner ${owner_id}...`);
        
        const readdirResult = await pgdb.query(`
            SELECT * FROM vfs2_readdir_by_owner($1, $2, $3)
        `, owner_id, testParentPath, testRootKey);
        
        console.log(`vfs2_readdir_by_owner returned ${readdirResult.rows.length} items for owner ${owner_id}:`);
        
        // Verify the results contain all files owned by the specified owner
        const expectedFiles = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d', 'dir-e'];
        const actualFilenames = readdirResult.rows.map((row: any) => row.filename);
        
        console.log('Expected files for owner:', expectedFiles);
        console.log('Actual files returned:  ', actualFilenames);
        
        // Check each item in the results
        readdirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, owner: ${row.owner_id}, ${row.is_directory ? 'directory' : 'file'})`);
            
            // Verify owner_id matches
            if (row.owner_id !== owner_id) {
                throw new Error(`Owner mismatch! Expected owner ${owner_id}, got ${row.owner_id} for file ${row.filename}`);
            }
        });

        // Verify the correct files are returned
        for (const filename of actualFilenames) {
            if (!expectedFiles.includes(filename)) {
                throw new Error(`Unexpected file returned: ${filename}`);
            }
        }
        
        // Verify we got all expected files
        for (const expectedFile of expectedFiles) {
            if (!actualFilenames.includes(expectedFile)) {
                throw new Error(`Expected file not returned: ${expectedFile}`);
            }
        }

        // Verify the ordering is correct (by ordinal)
        const expectedOrderByOrdinal = ['file-a.txt', 'file-b.txt', 'file-c.txt', 'dir-d', 'dir-e']; // ordinals: 1000, 2000, 3000, 4000, 5000
        if (JSON.stringify(actualFilenames) !== JSON.stringify(expectedOrderByOrdinal)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrderByOrdinal.join(', ')}, Got: ${actualFilenames.join(', ')}`);
        }

        // Test for a non-existent owner (this should return empty results)
        const nonExistentOwnerId = 999999; // Use a very high ID that's unlikely to exist
        console.log(`Testing vfs2_readdir_by_owner function for non-existent owner ${nonExistentOwnerId}...`);
        
        const readdirResult2 = await pgdb.query(`
            SELECT * FROM vfs2_readdir_by_owner($1, $2, $3)
        `, nonExistentOwnerId, testParentPath, testRootKey);
        
        console.log(`vfs2_readdir_by_owner returned ${readdirResult2.rows.length} items for non-existent owner ${nonExistentOwnerId}:`);
        
        // Verify no files are returned for non-existent owner
        if (readdirResult2.rows.length !== 0) {
            throw new Error(`Expected 0 files for non-existent owner, got: ${readdirResult2.rows.length}`);
        }

        console.log('✅ Owner filtering test passed');
        console.log('=== VFS2 Readdir By Owner Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Readdir By Owner Test Failed ===');
        console.error('Error during VFS2 readdir by owner test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}