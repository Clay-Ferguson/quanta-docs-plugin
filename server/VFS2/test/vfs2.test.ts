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
        
        // Run the get_max_ordinal test using the test runner
        await testRunner.run("getMaxOrdinalTest", () => getMaxOrdinalTest(owner_id), true);
        
        // Run the read_file test using the test runner
        await testRunner.run("readFileTest", () => readFileTest(owner_id), true);
        
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

export async function getMaxOrdinalTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-max-ordinal';
    
    try {
        console.log('=== VFS2 Get Max Ordinal Test Starting ===');

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
        
        // Test 1: Empty directory should return 0
        console.log('Testing empty directory (should return 0)...');
        
        const emptyResult = await pgdb.query(`
            SELECT vfs2_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const emptyMaxOrdinal = emptyResult.rows[0].max_ordinal;
        console.log(`Max ordinal for empty directory: ${emptyMaxOrdinal}`);
        
        if (emptyMaxOrdinal !== 0) {
            throw new Error(`Expected max ordinal 0 for empty directory, got: ${emptyMaxOrdinal}`);
        }
        
        // Test 2: Create files with various ordinal values and test max ordinal
        const testFiles = [
            { filename: 'file-100.txt', ordinal: 100, content: 'Content 100' },
            { filename: 'file-500.txt', ordinal: 500, content: 'Content 500' },
            { filename: 'file-250.txt', ordinal: 250, content: 'Content 250' },
            { filename: 'dir-750', ordinal: 750, isDirectory: true },
            { filename: 'file-1000.txt', ordinal: 1000, content: 'Content 1000' },
            { filename: 'file-50.txt', ordinal: 50, content: 'Content 50' },
        ];

        console.log('Creating test files with various ordinal values...');
        
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

        // Test the vfs2_get_max_ordinal function
        console.log('Testing vfs2_get_max_ordinal function...');
        
        const maxOrdinalResult = await pgdb.query(`
            SELECT vfs2_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const actualMaxOrdinal = maxOrdinalResult.rows[0].max_ordinal;
        const expectedMaxOrdinal = 1000; // Should be the highest ordinal from our test files
        
        console.log(`Max ordinal result: ${actualMaxOrdinal}`);
        console.log(`Expected max ordinal: ${expectedMaxOrdinal}`);
        
        if (actualMaxOrdinal !== expectedMaxOrdinal) {
            throw new Error(`Max ordinal mismatch! Expected: ${expectedMaxOrdinal}, Got: ${actualMaxOrdinal}`);
        }

        // Test 3: Add a file with an even higher ordinal to verify function updates correctly
        console.log('Adding file with higher ordinal (2000) to test function updates...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'file-2000.txt', 2000, 
        false, false, 'Content 2000', null, false, 'text/plain', Buffer.from('Content 2000').length);
        
        // Test max ordinal again
        const updatedMaxOrdinalResult = await pgdb.query(`
            SELECT vfs2_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const updatedMaxOrdinal = updatedMaxOrdinalResult.rows[0].max_ordinal;
        const expectedUpdatedMaxOrdinal = 2000;
        
        console.log(`Updated max ordinal result: ${updatedMaxOrdinal}`);
        console.log(`Expected updated max ordinal: ${expectedUpdatedMaxOrdinal}`);
        
        if (updatedMaxOrdinal !== expectedUpdatedMaxOrdinal) {
            throw new Error(`Updated max ordinal mismatch! Expected: ${expectedUpdatedMaxOrdinal}, Got: ${updatedMaxOrdinal}`);
        }

        // Test 4: Test that function only considers direct children (not sub-directories)
        const subDirectoryPath = testParentPath + '/subdir';
        
        console.log('Testing that function only considers direct children...');
        console.log(`Creating file in subdirectory: ${subDirectoryPath}`);
        
        // Create a subdirectory first
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'subdir', 800, 
        true, false, null, null, false, 'directory', 0);
        
        // Create a file in the subdirectory with a very high ordinal
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, subDirectoryPath, 'file-9999.txt', 9999, 
        false, false, 'Content 9999', null, false, 'text/plain', Buffer.from('Content 9999').length);
        
        console.log('Created file in subdirectory with ordinal 9999');
        
        // Test max ordinal for parent directory (should still be 2000, not affected by subdirectory content)
        const finalMaxOrdinalResult = await pgdb.query(`
            SELECT vfs2_get_max_ordinal($1, $2) as max_ordinal
        `, testParentPath, testRootKey);
        
        const finalMaxOrdinal = finalMaxOrdinalResult.rows[0].max_ordinal;
        const expectedFinalMaxOrdinal = 2000; // Should not include the 9999 from the subdirectory
        
        console.log(`Final max ordinal result (should ignore subdirectory): ${finalMaxOrdinal}`);
        console.log(`Expected final max ordinal: ${expectedFinalMaxOrdinal}`);
        
        if (finalMaxOrdinal !== expectedFinalMaxOrdinal) {
            throw new Error(`Final max ordinal mismatch! Function should only consider direct children. Expected: ${expectedFinalMaxOrdinal}, Got: ${finalMaxOrdinal}`);
        }

        console.log('✅ All max ordinal tests passed');
        console.log('=== VFS2 Get Max Ordinal Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Get Max Ordinal Test Failed ===');
        console.error('Error during VFS2 get max ordinal test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            // Clean up subdirectory and its contents first
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
            
            // Clean up main test directory
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}

export async function readFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-read-file';
    
    try {
        console.log('=== VFS2 Read File Test Starting ===');

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
        
        // Test 1: Create and read a text file
        const textFilename = 'test-text.md';
        const textContent = 'This is a **markdown** test file for VFS2 read function.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename} with content length: ${textContent.length}`);

        // Test reading the text file using vfs2_read_file function
        console.log('Testing vfs2_read_file function for text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT vfs2_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, textFilename, testRootKey);
        
        const retrievedTextBytes = textFileResult.rows[0].file_content;
        const retrievedTextContent = retrievedTextBytes ? retrievedTextBytes.toString('utf8') : null;
        
        console.log(`Retrieved text content: "${retrievedTextContent}"`);
        console.log(`Expected text content:  "${textContent}"`);
        
        if (retrievedTextContent !== textContent) {
            throw new Error(`Text content mismatch! Expected: "${textContent}", Got: "${retrievedTextContent}"`);
        }

        console.log('✅ Text file read test passed');

        // Test 2: Create and read a binary file
        const binaryFilename = 'test-binary.dat';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header bytes
        const binaryContentType = 'application/octet-stream';
        const binaryOrdinal = 2000;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename} with content length: ${binaryContent.length} bytes`);

        // Test reading the binary file using vfs2_read_file function
        console.log('Testing vfs2_read_file function for binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT vfs2_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const retrievedBinaryContent = binaryFileResult.rows[0].file_content;
        
        console.log(`Retrieved binary content length: ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        console.log(`Expected binary content length:  ${binaryContent.length} bytes`);
        
        if (!retrievedBinaryContent || !binaryContent.equals(retrievedBinaryContent)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        }

        console.log('✅ Binary file read test passed');

        // Test 3: Test reading non-existent file (should throw exception)
        console.log('Testing vfs2_read_file function for non-existent file...');
        
        try {
            await pgdb.query(`
                SELECT vfs2_read_file($1, $2, $3, $4) as file_content
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 4: Test admin access (owner_id = 0 should access all files)
        console.log('Testing admin access (owner_id = 0)...');
        
        const adminFileResult = await pgdb.query(`
            SELECT vfs2_read_file($1, $2, $3, $4) as file_content
        `, 0, testParentPath, textFilename, testRootKey); // owner_id = 0 (admin)
        
        const retrievedContentAsAdmin = adminFileResult.rows[0].file_content.toString('utf8');
        
        console.log(`Retrieved content as admin: "${retrievedContentAsAdmin}"`);
        console.log(`Expected content:           "${textContent}"`);
        
        if (retrievedContentAsAdmin !== textContent) {
            throw new Error(`Admin access content mismatch! Expected: "${textContent}", Got: "${retrievedContentAsAdmin}"`);
        }

        console.log('✅ Admin access test passed');
        console.log('=== VFS2 Read File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Read File Test Failed ===');
        console.error('Error during VFS2 read file test:', error);
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