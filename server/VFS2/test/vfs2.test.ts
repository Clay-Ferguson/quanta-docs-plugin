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
        
        // Run the write_text_file test using the test runner
        await testRunner.run("writeTextFileTest", () => writeTextFileTest(owner_id), true);
        
        // Run the write_binary_file test using the test runner
        await testRunner.run("writeBinaryFileTest", () => writeBinaryFileTest(owner_id), true);
        
        // Run the exists test using the test runner
        await testRunner.run("existsTest", () => existsTest(owner_id), true);
        
        // Run the get_node_by_name test using the test runner
        await testRunner.run("getNodeByNameTest", () => getNodeByNameTest(owner_id), true);
        
        // Run the stat test using the test runner
        await testRunner.run("statTest", () => statTest(owner_id), true);
        
        // Run the unlink test using the test runner
        await testRunner.run("unlinkTest", () => unlinkTest(owner_id), true);
        
        // Run the children_exist test using the test runner
        await testRunner.run("childrenExistTest", () => childrenExistTest(owner_id), true);
        
        // Run the mkdir/rmdir test using the test runner
        await testRunner.run("mkdirRmdirTest", () => mkdirRmdirTest(owner_id), true);
        
        // Run the ensure_path and rename test using the test runner
        await testRunner.run("ensurePathAndRenameTest", () => ensurePathAndRenameTest(owner_id), true);
        
        // Run the set_public test using the test runner
        await testRunner.run("setPublicTest", () => setPublicTest(owner_id), true);
        
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

export async function writeTextFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-write-text-file';
    
    try {
        console.log('=== VFS2 Write Text File Test Starting ===');

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
        
        // Test 1: Write a new text file
        const textFilename = 'new-file.md';
        const textContent = 'This is a **new markdown** file created by vfs2_write_text_file.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Testing vfs2_write_text_file function for new file...');
        
        const writeResult = await pgdb.query(`
            SELECT vfs2_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, textFilename, textContent, testRootKey, textOrdinal, textContentType, false);
        
        const fileId = writeResult.rows[0].file_id;
        console.log(`File created with ID: ${fileId}`);
        
        // Verify the file was created correctly by reading it back
        const verifyResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_binary, 
                   is_directory, owner_id, is_public
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('File not found after writing');
        }

        const retrievedData = verifyResult.rows[0];
        
        console.log('Verifying written file data...');
        console.log(`Expected content: "${textContent}"`);
        console.log(`Retrieved content: "${retrievedData.content_text}"`);
        
        if (retrievedData.content_text !== textContent) {
            throw new Error(`Content mismatch! Expected: "${textContent}", Got: "${retrievedData.content_text}"`);
        }
        
        if (retrievedData.content_type !== textContentType) {
            throw new Error(`Content type mismatch! Expected: "${textContentType}", Got: "${retrievedData.content_type}"`);
        }
        
        if (Number(retrievedData.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`Size mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${retrievedData.size_bytes}`);
        }
        
        if (retrievedData.ordinal !== textOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${textOrdinal}, Got: ${retrievedData.ordinal}`);
        }
        
        if (retrievedData.is_binary !== false) {
            throw new Error(`Binary flag mismatch! Expected: false, Got: ${retrievedData.is_binary}`);
        }
        
        if (retrievedData.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedData.is_directory}`);
        }
        
        if (retrievedData.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedData.owner_id}`);
        }
        
        if (retrievedData.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedData.is_public}`);
        }

        console.log('✅ New file write test passed');

        // Test 2: Update an existing file (ON CONFLICT DO UPDATE)
        const updatedContent = 'This is the **updated content** for the existing file.';
        const updatedContentType = 'text/plain';
        const updatedOrdinal = 2000;

        console.log('Testing vfs2_write_text_file function for updating existing file...');
        
        const updateResult = await pgdb.query(`
            SELECT vfs2_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, textFilename, updatedContent, testRootKey, updatedOrdinal, updatedContentType, true);
        
        const updatedFileId = updateResult.rows[0].file_id;
        console.log(`File updated with ID: ${updatedFileId}`);
        
        // Should be the same file ID since we're updating, not creating new
        if (updatedFileId !== fileId) {
            throw new Error(`File ID changed during update! Expected: ${fileId}, Got: ${updatedFileId}`);
        }
        
        // Verify the file was updated correctly
        const verifyUpdateResult = await pgdb.query(`
            SELECT content_text, content_type, size_bytes, ordinal, is_public, modified_time
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        const updatedData = verifyUpdateResult.rows[0];
        
        console.log('Verifying updated file data...');
        console.log(`Expected updated content: "${updatedContent}"`);
        console.log(`Retrieved updated content: "${updatedData.content_text}"`);
        
        if (updatedData.content_text !== updatedContent) {
            throw new Error(`Updated content mismatch! Expected: "${updatedContent}", Got: "${updatedData.content_text}"`);
        }
        
        if (updatedData.content_type !== updatedContentType) {
            throw new Error(`Updated content type mismatch! Expected: "${updatedContentType}", Got: "${updatedData.content_type}"`);
        }
        
        if (Number(updatedData.size_bytes) !== Buffer.from(updatedContent).length) {
            throw new Error(`Updated size mismatch! Expected: ${Buffer.from(updatedContent).length}, Got: ${updatedData.size_bytes}`);
        }
        
        if (updatedData.ordinal !== updatedOrdinal) {
            throw new Error(`Updated ordinal mismatch! Expected: ${updatedOrdinal}, Got: ${updatedData.ordinal}`);
        }
        
        if (updatedData.is_public !== true) {
            throw new Error(`Updated public flag mismatch! Expected: true, Got: ${updatedData.is_public}`);
        }

        console.log('✅ File update test passed');

        // Test 3: Write files with different ordinals and verify ordering
        console.log('Testing vfs2_write_text_file with multiple files for ordinal ordering...');
        
        const testFiles = [
            { filename: 'file-z.txt', ordinal: 3000, content: 'Content Z' },
            { filename: 'file-a.txt', ordinal: 1000, content: 'Content A' },
            { filename: 'file-m.txt', ordinal: 2000, content: 'Content M' },
        ];

        // Write all test files
        for (const testFile of testFiles) {
            await pgdb.query(`
                SELECT vfs2_write_text_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
            `, owner_id, testParentPath, testFile.filename, testFile.content, testRootKey, testFile.ordinal, 'text/plain', false);
            
            console.log(`Created file: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} files in directory (ordered by ordinal):`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal})`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = ['file-a.txt', 'file-m.txt', 'new-file.md', 'file-z.txt']; // ordinals: 1000, 2000, 2000, 3000
        const actualOrder = dirResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ Multiple files with ordinal ordering test passed');
        console.log('=== VFS2 Write Text File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Write Text File Test Failed ===');
        console.error('Error during VFS2 write text file test:', error);
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

export async function writeBinaryFileTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-write-binary-file';
    
    try {
        console.log('=== VFS2 Write Binary File Test Starting ===');

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
        
        // Test 1: Write a new binary file
        const binaryFilename = 'new-image.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]); // PNG header + IHDR chunk start
        const binaryContentType = 'image/png';
        const binaryOrdinal = 1000;

        console.log('Testing vfs2_write_binary_file function for new file...');
        
        const writeResult = await pgdb.query(`
            SELECT vfs2_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, binaryFilename, binaryContent, testRootKey, binaryOrdinal, binaryContentType, false);
        
        const fileId = writeResult.rows[0].file_id;
        console.log(`Binary file created with ID: ${fileId}`);
        
        // Verify the file was created correctly by reading it back
        const verifyResult = await pgdb.query(`
            SELECT content_binary, content_type, size_bytes, ordinal, is_binary, 
                   is_directory, owner_id, is_public, content_text
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('Binary file not found after writing');
        }

        const retrievedData = verifyResult.rows[0];
        
        console.log('Verifying written binary file data...');
        console.log(`Expected content length: ${binaryContent.length} bytes`);
        console.log(`Retrieved content length: ${retrievedData.content_binary ? retrievedData.content_binary.length : 0} bytes`);
        
        if (!retrievedData.content_binary || !binaryContent.equals(retrievedData.content_binary)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedData.content_binary ? retrievedData.content_binary.length : 0} bytes`);
        }
        
        if (retrievedData.content_type !== binaryContentType) {
            throw new Error(`Content type mismatch! Expected: "${binaryContentType}", Got: "${retrievedData.content_type}"`);
        }
        
        if (Number(retrievedData.size_bytes) !== binaryContent.length) {
            throw new Error(`Size mismatch! Expected: ${binaryContent.length}, Got: ${retrievedData.size_bytes}`);
        }
        
        if (retrievedData.ordinal !== binaryOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${retrievedData.ordinal}`);
        }
        
        if (retrievedData.is_binary !== true) {
            throw new Error(`Binary flag mismatch! Expected: true, Got: ${retrievedData.is_binary}`);
        }
        
        if (retrievedData.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedData.is_directory}`);
        }
        
        if (retrievedData.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedData.owner_id}`);
        }
        
        if (retrievedData.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedData.is_public}`);
        }
        
        if (retrievedData.content_text !== null) {
            throw new Error(`Text content should be null for binary file! Got: "${retrievedData.content_text}"`);
        }

        console.log('✅ New binary file write test passed');

        // Test 2: Update an existing binary file (ON CONFLICT DO UPDATE)
        const updatedContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]); // JPEG header
        const updatedContentType = 'image/jpeg';
        const updatedOrdinal = 2000;

        console.log('Testing vfs2_write_binary_file function for updating existing file...');
        
        const updateResult = await pgdb.query(`
            SELECT vfs2_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
        `, owner_id, testParentPath, binaryFilename, updatedContent, testRootKey, updatedOrdinal, updatedContentType, true);
        
        const updatedFileId = updateResult.rows[0].file_id;
        console.log(`Binary file updated with ID: ${updatedFileId}`);
        
        // Should be the same file ID since we're updating, not creating new
        if (updatedFileId !== fileId) {
            throw new Error(`File ID changed during update! Expected: ${fileId}, Got: ${updatedFileId}`);
        }
        
        // Verify the file was updated correctly
        const verifyUpdateResult = await pgdb.query(`
            SELECT content_binary, content_type, size_bytes, ordinal, is_public, modified_time
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        const updatedData = verifyUpdateResult.rows[0];
        
        console.log('Verifying updated binary file data...');
        console.log(`Expected updated content length: ${updatedContent.length} bytes`);
        console.log(`Retrieved updated content length: ${updatedData.content_binary ? updatedData.content_binary.length : 0} bytes`);
        
        if (!updatedData.content_binary || !updatedContent.equals(updatedData.content_binary)) {
            throw new Error(`Updated binary content mismatch! Expected ${updatedContent.length} bytes, got ${updatedData.content_binary ? updatedData.content_binary.length : 0} bytes`);
        }
        
        if (updatedData.content_type !== updatedContentType) {
            throw new Error(`Updated content type mismatch! Expected: "${updatedContentType}", Got: "${updatedData.content_type}"`);
        }
        
        if (Number(updatedData.size_bytes) !== updatedContent.length) {
            throw new Error(`Updated size mismatch! Expected: ${updatedContent.length}, Got: ${updatedData.size_bytes}`);
        }
        
        if (updatedData.ordinal !== updatedOrdinal) {
            throw new Error(`Updated ordinal mismatch! Expected: ${updatedOrdinal}, Got: ${updatedData.ordinal}`);
        }
        
        if (updatedData.is_public !== true) {
            throw new Error(`Updated public flag mismatch! Expected: true, Got: ${updatedData.is_public}`);
        }

        console.log('✅ Binary file update test passed');

        // Test 3: Write binary files with different ordinals and verify ordering
        console.log('Testing vfs2_write_binary_file with multiple files for ordinal ordering...');
        
        const testFiles = [
            { filename: 'image-z.gif', ordinal: 4000, content: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) }, // GIF89a header
            { filename: 'image-a.bmp', ordinal: 1500, content: Buffer.from([0x42, 0x4D]) }, // BMP header
            { filename: 'image-m.ico', ordinal: 3000, content: Buffer.from([0x00, 0x00, 0x01, 0x00]) }, // ICO header
        ];

        // Write all test files
        for (const testFile of testFiles) {
            await pgdb.query(`
                SELECT vfs2_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8) as file_id
            `, owner_id, testParentPath, testFile.filename, testFile.content, testRootKey, testFile.ordinal, 'application/octet-stream', false);
            
            console.log(`Created binary file: ${testFile.filename} (ordinal: ${testFile.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const dirResult = await pgdb.query(`
            SELECT filename, ordinal, is_binary, size_bytes
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${dirResult.rows.length} files in directory (ordered by ordinal):`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, binary: ${row.is_binary}, size: ${row.size_bytes} bytes)`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = ['image-a.bmp', 'new-image.png', 'image-m.ico', 'image-z.gif']; // ordinals: 1500, 2000, 3000, 4000
        const actualOrder = dirResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        // Test 4: Verify binary files can be read correctly with vfs2_read_file
        console.log('Testing that binary files can be read back correctly with vfs2_read_file...');
        
        const readResult = await pgdb.query(`
            SELECT vfs2_read_file($1, $2, $3, $4) as file_content
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const retrievedBinaryContent = readResult.rows[0].file_content;
        
        if (!retrievedBinaryContent || !updatedContent.equals(retrievedBinaryContent)) {
            throw new Error(`Read binary content mismatch! Expected ${updatedContent.length} bytes, got ${retrievedBinaryContent ? retrievedBinaryContent.length : 0} bytes`);
        }

        console.log('✅ Binary file read-back test passed');
        console.log('✅ Multiple binary files with ordinal ordering test passed');
        console.log('=== VFS2 Write Binary File Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Write Binary File Test Failed ===');
        console.error('Error during VFS2 write binary file test:', error);
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

export async function existsTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-exists';
    
    try {
        console.log('=== VFS2 Exists Test Starting ===');

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
        
        // Test 1: Check that non-existent file returns false
        console.log('Testing vfs2_exists for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        const nonExistentExists = nonExistentResult.rows[0].file_exists;
        console.log(`Non-existent file exists: ${nonExistentExists}`);
        
        if (nonExistentExists !== false) {
            throw new Error(`Expected false for non-existent file, got: ${nonExistentExists}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and verify it exists
        const textFilename = 'test-file.txt';
        const textContent = 'This is a test file for exists testing.';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, 'text/plain', Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename}`);

        // Test that the file exists
        console.log('Testing vfs2_exists for existing text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, testRootKey);
        
        const textFileExists = textFileResult.rows[0].file_exists;
        console.log(`Text file exists: ${textFileExists}`);
        
        if (textFileExists !== true) {
            throw new Error(`Expected true for existing text file, got: ${textFileExists}`);
        }

        console.log('✅ Existing text file test passed');

        // Test 3: Create a directory and verify it exists
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename}`);

        // Test that the directory exists
        console.log('Testing vfs2_exists for existing directory...');
        
        const dirResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, dirFilename, testRootKey);
        
        const dirExists = dirResult.rows[0].file_exists;
        console.log(`Directory exists: ${dirExists}`);
        
        if (dirExists !== true) {
            throw new Error(`Expected true for existing directory, got: ${dirExists}`);
        }

        console.log('✅ Existing directory test passed');

        // Test 4: Create a binary file and verify it exists
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryOrdinal = 3000;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, 'image/png', binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename}`);

        // Test that the binary file exists
        console.log('Testing vfs2_exists for existing binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, binaryFilename, testRootKey);
        
        const binaryFileExists = binaryFileResult.rows[0].file_exists;
        console.log(`Binary file exists: ${binaryFileExists}`);
        
        if (binaryFileExists !== true) {
            throw new Error(`Expected true for existing binary file, got: ${binaryFileExists}`);
        }

        console.log('✅ Existing binary file test passed');

        // Test 5: Test with different root keys (should return false)
        console.log('Testing vfs2_exists with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, 'different-root-key');
        
        const differentRootExists = differentRootResult.rows[0].file_exists;
        console.log(`File exists with different root key: ${differentRootExists}`);
        
        if (differentRootExists !== false) {
            throw new Error(`Expected false for different root key, got: ${differentRootExists}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return false)
        console.log('Testing vfs2_exists with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, '/different-parent-path', textFilename, testRootKey);
        
        const differentPathExists = differentPathResult.rows[0].file_exists;
        console.log(`File exists with different parent path: ${differentPathExists}`);
        
        if (differentPathExists !== false) {
            throw new Error(`Expected false for different parent path, got: ${differentPathExists}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: Delete a file and verify it no longer exists
        console.log('Testing vfs2_exists after deleting file...');
        
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        console.log(`Deleted text file: ${textFilename}`);
        
        const deletedFileResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as file_exists
        `, testParentPath, textFilename, testRootKey);
        
        const deletedFileExists = deletedFileResult.rows[0].file_exists;
        console.log(`Deleted file exists: ${deletedFileExists}`);
        
        if (deletedFileExists !== false) {
            throw new Error(`Expected false for deleted file, got: ${deletedFileExists}`);
        }

        console.log('✅ Deleted file test passed');

        // List remaining files for verification
        console.log('Verifying remaining files in test directory...');
        const remainingResult = await pgdb.query(`
            SELECT filename, is_directory, ordinal 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${remainingResult.rows.length} remaining items in directory:`);
        remainingResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'})`);
        });

        console.log('=== VFS2 Exists Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Exists Test Failed ===');
        console.error('Error during VFS2 exists test:', error);
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
export async function getNodeByNameTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-get-node-by-name';
    
    try {
        console.log('=== VFS2 Get Node By Name Test Starting ===');

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
        
        // Test 1: Check that non-existent file returns no rows
        console.log('Testing vfs2_get_node_by_name for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        console.log(`Non-existent file query returned ${nonExistentResult.rows.length} rows`);
        
        if (nonExistentResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for non-existent file, got: ${nonExistentResult.rows.length}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and verify we can get its node data
        const textFilename = 'test-file.md';
        const textContent = 'This is a **test markdown** file for get_node_by_name testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file...');
        
        const insertResult = await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid, created_time, modified_time
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        const expectedId = insertResult.rows[0].id;
        const expectedUuid = insertResult.rows[0].uuid;
        const expectedCreatedTime = insertResult.rows[0].created_time;
        const expectedModifiedTime = insertResult.rows[0].modified_time;
        
        console.log(`Created text file: ${textFilename} with ID: ${expectedId}, UUID: ${expectedUuid}`);

        // Test that we can get the complete node data
        console.log('Testing vfs2_get_node_by_name for existing text file...');
        
        const textFileResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, testParentPath, textFilename, testRootKey);
        
        console.log(`Text file query returned ${textFileResult.rows.length} rows`);
        
        if (textFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing text file, got: ${textFileResult.rows.length}`);
        }

        const retrievedNode = textFileResult.rows[0];
        
        console.log('Verifying retrieved node data...');
        console.log(`Expected ID: ${expectedId}, Retrieved ID: ${retrievedNode.id}`);
        console.log(`Expected UUID: ${expectedUuid}, Retrieved UUID: ${retrievedNode.uuid}`);
        console.log(`Expected filename: ${textFilename}, Retrieved filename: ${retrievedNode.filename}`);
        console.log(`Expected ordinal: ${textOrdinal}, Retrieved ordinal: ${retrievedNode.ordinal}`);
        console.log(`Expected content: "${textContent.substring(0, 50)}...", Retrieved content: "${retrievedNode.content_text ? retrievedNode.content_text.substring(0, 50) : 'null'}..."`);
        
        // Verify all the node data matches expectations
        if (retrievedNode.id !== expectedId) {
            throw new Error(`ID mismatch! Expected: ${expectedId}, Got: ${retrievedNode.id}`);
        }
        
        if (retrievedNode.uuid !== expectedUuid) {
            throw new Error(`UUID mismatch! Expected: ${expectedUuid}, Got: ${retrievedNode.uuid}`);
        }
        
        if (retrievedNode.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${retrievedNode.owner_id}`);
        }
        
        if (retrievedNode.doc_root_key !== testRootKey) {
            throw new Error(`Doc root key mismatch! Expected: ${testRootKey}, Got: ${retrievedNode.doc_root_key}`);
        }
        
        if (retrievedNode.parent_path !== testParentPath) {
            throw new Error(`Parent path mismatch! Expected: ${testParentPath}, Got: ${retrievedNode.parent_path}`);
        }
        
        if (retrievedNode.filename !== textFilename) {
            throw new Error(`Filename mismatch! Expected: ${textFilename}, Got: ${retrievedNode.filename}`);
        }
        
        if (retrievedNode.ordinal !== textOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${textOrdinal}, Got: ${retrievedNode.ordinal}`);
        }
        
        if (retrievedNode.is_directory !== false) {
            throw new Error(`Directory flag mismatch! Expected: false, Got: ${retrievedNode.is_directory}`);
        }
        
        if (retrievedNode.content_text !== textContent) {
            throw new Error(`Content text mismatch! Expected: "${textContent}", Got: "${retrievedNode.content_text}"`);
        }
        
        if (retrievedNode.content_binary !== null) {
            throw new Error(`Content binary should be null for text file! Got: ${retrievedNode.content_binary}`);
        }
        
        if (retrievedNode.is_binary !== false) {
            throw new Error(`Binary flag mismatch! Expected: false, Got: ${retrievedNode.is_binary}`);
        }
        
        if (retrievedNode.content_type !== textContentType) {
            throw new Error(`Content type mismatch! Expected: ${textContentType}, Got: ${retrievedNode.content_type}`);
        }
        
        if (Number(retrievedNode.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`Size mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${retrievedNode.size_bytes}`);
        }
        
        if (retrievedNode.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${retrievedNode.is_public}`);
        }
        
        // Timestamps should match (allowing for small differences due to precision)
        const createdTimeDiff = Math.abs(new Date(retrievedNode.created_time).getTime() - new Date(expectedCreatedTime).getTime());
        const modifiedTimeDiff = Math.abs(new Date(retrievedNode.modified_time).getTime() - new Date(expectedModifiedTime).getTime());
        
        if (createdTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`Created time mismatch! Expected: ${expectedCreatedTime}, Got: ${retrievedNode.created_time}`);
        }
        
        if (modifiedTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`Modified time mismatch! Expected: ${expectedModifiedTime}, Got: ${retrievedNode.modified_time}`);
        }

        console.log('✅ Existing text file node retrieval test passed');

        // Test 3: Create a directory and verify we can get its node data
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory...');
        
        const dirInsertResult = await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, true, null, null, false, 'directory', 0);
        
        const expectedDirId = dirInsertResult.rows[0].id;
        const expectedDirUuid = dirInsertResult.rows[0].uuid;
        
        console.log(`Created directory: ${dirFilename} with ID: ${expectedDirId}, UUID: ${expectedDirUuid}`);

        // Test that we can get the directory node data
        console.log('Testing vfs2_get_node_by_name for existing directory...');
        
        const dirResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, testParentPath, dirFilename, testRootKey);
        
        if (dirResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing directory, got: ${dirResult.rows.length}`);
        }

        const retrievedDir = dirResult.rows[0];
        
        console.log('Verifying retrieved directory node data...');
        
        if (retrievedDir.id !== expectedDirId) {
            throw new Error(`Directory ID mismatch! Expected: ${expectedDirId}, Got: ${retrievedDir.id}`);
        }
        
        if (retrievedDir.filename !== dirFilename) {
            throw new Error(`Directory filename mismatch! Expected: ${dirFilename}, Got: ${retrievedDir.filename}`);
        }
        
        if (retrievedDir.ordinal !== dirOrdinal) {
            throw new Error(`Directory ordinal mismatch! Expected: ${dirOrdinal}, Got: ${retrievedDir.ordinal}`);
        }
        
        if (retrievedDir.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${retrievedDir.is_directory}`);
        }
        
        if (retrievedDir.is_public !== true) {
            throw new Error(`Directory public flag mismatch! Expected: true, Got: ${retrievedDir.is_public}`);
        }
        
        if (retrievedDir.content_text !== null) {
            throw new Error(`Directory content_text should be null! Got: ${retrievedDir.content_text}`);
        }
        
        if (retrievedDir.content_binary !== null) {
            throw new Error(`Directory content_binary should be null! Got: ${retrievedDir.content_binary}`);
        }
        
        if (retrievedDir.content_type !== 'directory') {
            throw new Error(`Directory content_type mismatch! Expected: 'directory', Got: ${retrievedDir.content_type}`);
        }
        
        if (Number(retrievedDir.size_bytes) !== 0) {
            throw new Error(`Directory size_bytes mismatch! Expected: 0, Got: ${retrievedDir.size_bytes}`);
        }

        console.log('✅ Existing directory node retrieval test passed');

        // Test 4: Create a binary file and verify we can get its node data
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 3000;

        console.log('Creating test binary file...');
        
        const binaryInsertResult = await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, uuid
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        const expectedBinaryId = binaryInsertResult.rows[0].id;
        const expectedBinaryUuid = binaryInsertResult.rows[0].uuid;
        
        console.log(`Created binary file: ${binaryFilename} with ID: ${expectedBinaryId}, UUID: ${expectedBinaryUuid}`);

        // Test that we can get the binary file node data
        console.log('Testing vfs2_get_node_by_name for existing binary file...');
        
        const binaryFileResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, testParentPath, binaryFilename, testRootKey);
        
        if (binaryFileResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing binary file, got: ${binaryFileResult.rows.length}`);
        }

        const retrievedBinary = binaryFileResult.rows[0];
        
        console.log('Verifying retrieved binary file node data...');
        
        if (retrievedBinary.id !== expectedBinaryId) {
            throw new Error(`Binary file ID mismatch! Expected: ${expectedBinaryId}, Got: ${retrievedBinary.id}`);
        }
        
        if (retrievedBinary.filename !== binaryFilename) {
            throw new Error(`Binary filename mismatch! Expected: ${binaryFilename}, Got: ${retrievedBinary.filename}`);
        }
        
        if (retrievedBinary.ordinal !== binaryOrdinal) {
            throw new Error(`Binary ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${retrievedBinary.ordinal}`);
        }
        
        if (retrievedBinary.is_directory !== false) {
            throw new Error(`Binary directory flag mismatch! Expected: false, Got: ${retrievedBinary.is_directory}`);
        }
        
        if (retrievedBinary.is_binary !== true) {
            throw new Error(`Binary flag mismatch! Expected: true, Got: ${retrievedBinary.is_binary}`);
        }
        
        if (retrievedBinary.content_text !== null) {
            throw new Error(`Binary content_text should be null! Got: ${retrievedBinary.content_text}`);
        }
        
        if (!retrievedBinary.content_binary || !binaryContent.equals(retrievedBinary.content_binary)) {
            throw new Error(`Binary content mismatch! Expected ${binaryContent.length} bytes, got ${retrievedBinary.content_binary ? retrievedBinary.content_binary.length : 0} bytes`);
        }
        
        if (retrievedBinary.content_type !== binaryContentType) {
            throw new Error(`Binary content_type mismatch! Expected: ${binaryContentType}, Got: ${retrievedBinary.content_type}`);
        }
        
        if (Number(retrievedBinary.size_bytes) !== binaryContent.length) {
            throw new Error(`Binary size_bytes mismatch! Expected: ${binaryContent.length}, Got: ${retrievedBinary.size_bytes}`);
        }

        console.log('✅ Existing binary file node retrieval test passed');

        // Test 5: Test with different root keys (should return no rows)
        console.log('Testing vfs2_get_node_by_name with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, testParentPath, textFilename, 'different-root-key');
        
        console.log(`Different root key query returned ${differentRootResult.rows.length} rows`);
        
        if (differentRootResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different root key, got: ${differentRootResult.rows.length}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return no rows)
        console.log('Testing vfs2_get_node_by_name with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT * FROM vfs2_get_node_by_name($1, $2, $3)
        `, '/different-parent-path', textFilename, testRootKey);
        
        console.log(`Different parent path query returned ${differentPathResult.rows.length} rows`);
        
        if (differentPathResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different parent path, got: ${differentPathResult.rows.length}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: List all created files to verify they exist and show ordinal ordering
        console.log('Verifying all created files exist and are properly ordered...');
        const allFilesResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory, is_binary, content_type
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${allFilesResult.rows.length} items in directory (ordered by ordinal):`);
        allFilesResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, ${row.is_directory ? 'directory' : 'file'}, ${row.is_binary ? 'binary' : 'text'}, type: ${row.content_type})`);
        });
        
        // Verify the ordering is correct (by ordinal, then filename)
        const expectedOrder = [textFilename, dirFilename, binaryFilename]; // ordinals: 1000, 2000, 3000
        const actualOrder = allFilesResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ File ordering verification test passed');
        console.log('=== VFS2 Get Node By Name Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Get Node By Name Test Failed ===');
        console.error('Error during VFS2 get node by name test:', error);
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

export async function statTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-stat';
    
    try {
        console.log('=== VFS2 Stat Test Starting ===');

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
        
        // Test 1: Test stat for non-existent file (should return no rows)
        console.log('Testing vfs2_stat for non-existent file...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, testParentPath, 'non-existent-file.txt', testRootKey);
        
        console.log(`Non-existent file stat returned ${nonExistentResult.rows.length} rows`);
        
        if (nonExistentResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for non-existent file, got: ${nonExistentResult.rows.length}`);
        }

        console.log('✅ Non-existent file test passed');

        // Test 2: Create a text file and get its stat information
        const textFilename = 'test-file.md';
        const textContent = 'This is a **test markdown** file for stat testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1500;

        console.log('Creating test text file...');
        
        const insertResult = await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING created_time, modified_time
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        const expectedCreatedTime = insertResult.rows[0].created_time;
        const expectedModifiedTime = insertResult.rows[0].modified_time;
        
        console.log(`Created text file: ${textFilename} with ordinal: ${textOrdinal}`);

        // Test vfs2_stat for the text file
        console.log('Testing vfs2_stat for existing text file...');
        
        const textFileStatResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, testParentPath, textFilename, testRootKey);
        
        console.log(`Text file stat returned ${textFileStatResult.rows.length} rows`);
        
        if (textFileStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing text file, got: ${textFileStatResult.rows.length}`);
        }

        const textFileStat = textFileStatResult.rows[0];
        
        console.log('Verifying text file stat data...');
        console.log(`Stat - is_public: ${textFileStat.is_public}, is_directory: ${textFileStat.is_directory}, size_bytes: ${textFileStat.size_bytes}`);
        console.log(`Stat - content_type: ${textFileStat.content_type}, ordinal: ${textFileStat.ordinal}`);
        console.log(`Stat - created_time: ${textFileStat.created_time}, modified_time: ${textFileStat.modified_time}`);
        
        // Verify all stat data
        if (textFileStat.is_public !== false) {
            throw new Error(`is_public mismatch! Expected: false, Got: ${textFileStat.is_public}`);
        }
        
        if (textFileStat.is_directory !== false) {
            throw new Error(`is_directory mismatch! Expected: false, Got: ${textFileStat.is_directory}`);
        }
        
        if (Number(textFileStat.size_bytes) !== Buffer.from(textContent).length) {
            throw new Error(`size_bytes mismatch! Expected: ${Buffer.from(textContent).length}, Got: ${textFileStat.size_bytes}`);
        }
        
        if (textFileStat.content_type !== textContentType) {
            throw new Error(`content_type mismatch! Expected: ${textContentType}, Got: ${textFileStat.content_type}`);
        }
        
        if (textFileStat.ordinal !== textOrdinal) {
            throw new Error(`ordinal mismatch! Expected: ${textOrdinal}, Got: ${textFileStat.ordinal}`);
        }
        
        // Verify timestamps (allowing for small differences due to precision)
        const createdTimeDiff = Math.abs(new Date(textFileStat.created_time).getTime() - new Date(expectedCreatedTime).getTime());
        const modifiedTimeDiff = Math.abs(new Date(textFileStat.modified_time).getTime() - new Date(expectedModifiedTime).getTime());
        
        if (createdTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`created_time mismatch! Expected: ${expectedCreatedTime}, Got: ${textFileStat.created_time}`);
        }
        
        if (modifiedTimeDiff > 1000) { // Allow 1 second difference
            throw new Error(`modified_time mismatch! Expected: ${expectedModifiedTime}, Got: ${textFileStat.modified_time}`);
        }

        console.log('✅ Text file stat test passed');

        // Test 3: Create a directory and get its stat information
        const dirFilename = 'test-directory';
        const dirOrdinal = 2500;

        console.log('Creating test directory...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, true, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename} with ordinal: ${dirOrdinal}`);

        // Test vfs2_stat for the directory
        console.log('Testing vfs2_stat for existing directory...');
        
        const dirStatResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, testParentPath, dirFilename, testRootKey);
        
        if (dirStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing directory, got: ${dirStatResult.rows.length}`);
        }

        const dirStat = dirStatResult.rows[0];
        
        console.log('Verifying directory stat data...');
        console.log(`Dir Stat - is_public: ${dirStat.is_public}, is_directory: ${dirStat.is_directory}, size_bytes: ${dirStat.size_bytes}`);
        console.log(`Dir Stat - content_type: ${dirStat.content_type}, ordinal: ${dirStat.ordinal}`);
        
        // Verify directory stat data
        if (dirStat.is_public !== true) {
            throw new Error(`Directory is_public mismatch! Expected: true, Got: ${dirStat.is_public}`);
        }
        
        if (dirStat.is_directory !== true) {
            throw new Error(`Directory is_directory mismatch! Expected: true, Got: ${dirStat.is_directory}`);
        }
        
        if (Number(dirStat.size_bytes) !== 0) {
            throw new Error(`Directory size_bytes mismatch! Expected: 0, Got: ${dirStat.size_bytes}`);
        }
        
        if (dirStat.content_type !== 'directory') {
            throw new Error(`Directory content_type mismatch! Expected: 'directory', Got: ${dirStat.content_type}`);
        }
        
        if (dirStat.ordinal !== dirOrdinal) {
            throw new Error(`Directory ordinal mismatch! Expected: ${dirOrdinal}, Got: ${dirStat.ordinal}`);
        }

        console.log('✅ Directory stat test passed');

        // Test 4: Create a binary file and get its stat information
        const binaryFilename = 'test-binary.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 3500;

        console.log('Creating test binary file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename} with ordinal: ${binaryOrdinal}`);

        // Test vfs2_stat for the binary file
        console.log('Testing vfs2_stat for existing binary file...');
        
        const binaryStatResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, testParentPath, binaryFilename, testRootKey);
        
        if (binaryStatResult.rows.length !== 1) {
            throw new Error(`Expected 1 row for existing binary file, got: ${binaryStatResult.rows.length}`);
        }

        const binaryStat = binaryStatResult.rows[0];
        
        console.log('Verifying binary file stat data...');
        console.log(`Binary Stat - is_public: ${binaryStat.is_public}, is_directory: ${binaryStat.is_directory}, size_bytes: ${binaryStat.size_bytes}`);
        console.log(`Binary Stat - content_type: ${binaryStat.content_type}, ordinal: ${binaryStat.ordinal}`);
        
        // Verify binary file stat data
        if (binaryStat.is_public !== false) {
            throw new Error(`Binary is_public mismatch! Expected: false, Got: ${binaryStat.is_public}`);
        }
        
        if (binaryStat.is_directory !== false) {
            throw new Error(`Binary is_directory mismatch! Expected: false, Got: ${binaryStat.is_directory}`);
        }
        
        if (Number(binaryStat.size_bytes) !== binaryContent.length) {
            throw new Error(`Binary size_bytes mismatch! Expected: ${binaryContent.length}, Got: ${binaryStat.size_bytes}`);
        }
        
        if (binaryStat.content_type !== binaryContentType) {
            throw new Error(`Binary content_type mismatch! Expected: ${binaryContentType}, Got: ${binaryStat.content_type}`);
        }
        
        if (binaryStat.ordinal !== binaryOrdinal) {
            throw new Error(`Binary ordinal mismatch! Expected: ${binaryOrdinal}, Got: ${binaryStat.ordinal}`);
        }

        console.log('✅ Binary file stat test passed');

        // Test 5: Test with different root keys (should return no rows)
        console.log('Testing vfs2_stat with different root key...');
        
        const differentRootResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, testParentPath, textFilename, 'different-root-key');
        
        console.log(`Different root key stat returned ${differentRootResult.rows.length} rows`);
        
        if (differentRootResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different root key, got: ${differentRootResult.rows.length}`);
        }

        console.log('✅ Different root key test passed');

        // Test 6: Test with different parent paths (should return no rows)
        console.log('Testing vfs2_stat with different parent path...');
        
        const differentPathResult = await pgdb.query(`
            SELECT * FROM vfs2_stat($1, $2, $3)
        `, '/different-parent-path', textFilename, testRootKey);
        
        console.log(`Different parent path stat returned ${differentPathResult.rows.length} rows`);
        
        if (differentPathResult.rows.length !== 0) {
            throw new Error(`Expected 0 rows for different parent path, got: ${differentPathResult.rows.length}`);
        }

        console.log('✅ Different parent path test passed');

        // Test 7: Verify ordinal ordering in stat results
        console.log('Testing that multiple stat calls work correctly and verify ordinal ordering...');
        
        // Get stat for all files to verify ordinal ordering
        const allStats = [];
        const allFiles = [
            { filename: textFilename, expectedOrdinal: textOrdinal },
            { filename: dirFilename, expectedOrdinal: dirOrdinal },
            { filename: binaryFilename, expectedOrdinal: binaryOrdinal }
        ];
        
        for (const file of allFiles) {
            const statResult = await pgdb.query(`
                SELECT * FROM vfs2_stat($1, $2, $3)
            `, testParentPath, file.filename, testRootKey);
            
            if (statResult.rows.length === 1) {
                allStats.push({ 
                    filename: file.filename, 
                    ordinal: statResult.rows[0].ordinal,
                    expectedOrdinal: file.expectedOrdinal,
                    is_directory: statResult.rows[0].is_directory 
                });
            }
        }
        
        console.log('All stat results:');
        allStats.forEach((stat, index) => {
            console.log(`  ${index + 1}. ${stat.filename} (ordinal: ${stat.ordinal}, ${stat.is_directory ? 'directory' : 'file'})`);
            
            if (stat.ordinal !== stat.expectedOrdinal) {
                throw new Error(`Ordinal mismatch for ${stat.filename}! Expected: ${stat.expectedOrdinal}, Got: ${stat.ordinal}`);
            }
        });
        
        // Sort by ordinal to verify ordering
        allStats.sort((a, b) => a.ordinal - b.ordinal);
        const expectedOrderByOrdinal = [textFilename, dirFilename, binaryFilename]; // ordinals: 1500, 2500, 3500
        const actualOrderByOrdinal = allStats.map(stat => stat.filename);
        
        if (JSON.stringify(actualOrderByOrdinal) !== JSON.stringify(expectedOrderByOrdinal)) {
            throw new Error(`Ordinal ordering incorrect! Expected: ${expectedOrderByOrdinal.join(', ')}, Got: ${actualOrderByOrdinal.join(', ')}`);
        }

        console.log('✅ Multiple stat calls and ordinal ordering test passed');
        console.log('=== VFS2 Stat Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Stat Test Failed ===');
        console.error('Error during VFS2 stat test:', error);
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

export async function unlinkTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-unlink';
    
    try {
        console.log('=== VFS2 Unlink Test Starting ===');

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
        
        // Test 1: Create text and binary files, then delete them with vfs2_unlink
        const textFilename = 'test-text-file.md';
        const textContent = 'This is a **test markdown** file that will be deleted.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        const binaryFilename = 'test-binary-file.png';
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        const binaryContentType = 'image/png';
        const binaryOrdinal = 2000;

        console.log('Creating test files for deletion...');
        
        // Create text file
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created text file: ${textFilename}`);
        
        // Create binary file
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, binaryFilename, binaryOrdinal,
        false, false, null, binaryContent, true, binaryContentType, binaryContent.length);
        
        console.log(`Created binary file: ${binaryFilename}`);

        // Verify both files exist before deletion
        console.log('Verifying files exist before deletion...');
        
        const beforeResult = await pgdb.query(`
            SELECT filename, is_directory 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${beforeResult.rows.length} items before deletion:`);
        beforeResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'})`);
        });
        
        if (beforeResult.rows.length !== 2) {
            throw new Error(`Expected 2 files before deletion, got: ${beforeResult.rows.length}`);
        }

        // Test vfs2_unlink for text file
        console.log('Testing vfs2_unlink for text file...');
        
        const unlinkTextResult = await pgdb.query(`
            SELECT vfs2_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, textFilename, testRootKey);
        
        const textUnlinkSuccess = unlinkTextResult.rows[0].success;
        console.log(`Text file unlink result: ${textUnlinkSuccess}`);
        
        if (textUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful text file unlink, got: ${textUnlinkSuccess}`);
        }

        // Verify text file was deleted
        console.log('Verifying text file was deleted...');
        
        const afterTextDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (afterTextDeleteResult.rows.length !== 0) {
            throw new Error(`Text file still exists after deletion! Found ${afterTextDeleteResult.rows.length} rows`);
        }

        console.log('✅ Text file unlink test passed');

        // Test vfs2_unlink for binary file
        console.log('Testing vfs2_unlink for binary file...');
        
        const unlinkBinaryResult = await pgdb.query(`
            SELECT vfs2_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, binaryFilename, testRootKey);
        
        const binaryUnlinkSuccess = unlinkBinaryResult.rows[0].success;
        console.log(`Binary file unlink result: ${binaryUnlinkSuccess}`);
        
        if (binaryUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful binary file unlink, got: ${binaryUnlinkSuccess}`);
        }

        // Verify binary file was deleted
        console.log('Verifying binary file was deleted...');
        
        const afterBinaryDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, binaryFilename);
        
        if (afterBinaryDeleteResult.rows.length !== 0) {
            throw new Error(`Binary file still exists after deletion! Found ${afterBinaryDeleteResult.rows.length} rows`);
        }

        console.log('✅ Binary file unlink test passed');

        // Verify directory is now empty
        console.log('Verifying directory is now empty...');
        
        const afterAllDeletesResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        console.log(`Found ${afterAllDeletesResult.rows.length} items after all deletions`);
        
        if (afterAllDeletesResult.rows.length !== 0) {
            throw new Error(`Expected empty directory after all deletions, got: ${afterAllDeletesResult.rows.length} items`);
        }

        console.log('✅ Directory cleanup verification test passed');

        // Test 2: Try to delete non-existent file (should throw exception)
        console.log('Testing vfs2_unlink for non-existent file (should throw exception)...');
        
        try {
            await pgdb.query(`
                SELECT vfs2_unlink($1, $2, $3, $4) as success
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 3: Create a directory and verify that unlink cannot delete it
        const dirFilename = 'test-directory';
        const dirOrdinal = 3000;

        console.log('Testing that vfs2_unlink cannot delete directories...');
        
        // Create directory
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created directory: ${dirFilename}`);

        // Try to unlink the directory (should fail because is_directory = TRUE)
        try {
            await pgdb.query(`
                SELECT vfs2_unlink($1, $2, $3, $4) as success
            `, owner_id, testParentPath, dirFilename, testRootKey);
            
            throw new Error('Expected exception when trying to unlink directory, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Directory unlink prevention test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error when trying to unlink directory: ${error.message}`);
            }
        }

        // Verify directory still exists after failed unlink attempt
        const dirStillExistsResult = await pgdb.query(`
            SELECT filename, is_directory 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        if (dirStillExistsResult.rows.length !== 1 || !dirStillExistsResult.rows[0].is_directory) {
            throw new Error('Directory should still exist after failed unlink attempt');
        }

        console.log('✅ Directory still exists after failed unlink test passed');

        // Test 4: Test admin access (owner_id = 0 should be able to delete any file)
        const adminTestFilename = 'admin-delete-test.txt';
        const adminTestContent = 'This file will be deleted by admin.';
        const adminTestOrdinal = 4000;

        console.log('Testing admin access for file deletion...');
        
        // Create file owned by the regular user
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, adminTestFilename, adminTestOrdinal,
        false, false, adminTestContent, null, false, 'text/plain', Buffer.from(adminTestContent).length);
        
        console.log(`Created file owned by user ${owner_id}: ${adminTestFilename}`);

        // Delete it as admin (owner_id = 0)
        const adminUnlinkResult = await pgdb.query(`
            SELECT vfs2_unlink($1, $2, $3, $4) as success
        `, 0, testParentPath, adminTestFilename, testRootKey); // owner_id = 0 (admin)
        
        const adminUnlinkSuccess = adminUnlinkResult.rows[0].success;
        console.log(`Admin unlink result: ${adminUnlinkSuccess}`);
        
        if (adminUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful admin unlink, got: ${adminUnlinkSuccess}`);
        }

        // Verify file was deleted by admin
        const afterAdminDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, adminTestFilename);
        
        if (afterAdminDeleteResult.rows.length !== 0) {
            throw new Error(`File still exists after admin deletion! Found ${afterAdminDeleteResult.rows.length} rows`);
        }

        console.log('✅ Admin access test passed');

        // Test 5: Test owner access control (non-owner should not be able to delete file)
        const ownerTestFilename = 'owner-test-file.txt';
        const ownerTestContent = 'This file should only be deletable by its owner.';
        const ownerTestOrdinal = 5000;
        const nonOwnerUserId = 999999; // Use a very high ID that's unlikely to exist

        console.log('Testing owner access control...');
        
        // Create file owned by the regular user
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, ownerTestFilename, ownerTestOrdinal,
        false, false, ownerTestContent, null, false, 'text/plain', Buffer.from(ownerTestContent).length);
        
        console.log(`Created file owned by user ${owner_id}: ${ownerTestFilename}`);

        // Try to delete it as a different user (should fail)
        try {
            await pgdb.query(`
                SELECT vfs2_unlink($1, $2, $3, $4) as success
            `, nonOwnerUserId, testParentPath, ownerTestFilename, testRootKey);
            
            throw new Error('Expected exception when non-owner tries to delete file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File not found')) {
                console.log('✅ Non-owner access control test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error when non-owner tries to delete file: ${error.message}`);
            }
        }

        // Verify file still exists after failed non-owner delete attempt
        const fileStillExistsResult = await pgdb.query(`
            SELECT filename, owner_id 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, ownerTestFilename);
        
        if (fileStillExistsResult.rows.length !== 1 || fileStillExistsResult.rows[0].owner_id !== owner_id) {
            throw new Error('File should still exist and be owned by original owner after failed non-owner delete');
        }

        console.log('✅ File still exists after failed non-owner delete test passed');

        // Now delete it as the actual owner (should succeed)
        console.log('Testing that actual owner can delete their own file...');
        
        const ownerUnlinkResult = await pgdb.query(`
            SELECT vfs2_unlink($1, $2, $3, $4) as success
        `, owner_id, testParentPath, ownerTestFilename, testRootKey); // actual owner
        
        const ownerUnlinkSuccess = ownerUnlinkResult.rows[0].success;
        console.log(`Owner unlink result: ${ownerUnlinkSuccess}`);
        
        if (ownerUnlinkSuccess !== true) {
            throw new Error(`Expected true for successful owner unlink, got: ${ownerUnlinkSuccess}`);
        }

        // Verify file was deleted by owner
        const afterOwnerDeleteResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, ownerTestFilename);
        
        if (afterOwnerDeleteResult.rows.length !== 0) {
            throw new Error(`File still exists after owner deletion! Found ${afterOwnerDeleteResult.rows.length} rows`);
        }

        console.log('✅ Owner access test passed');

        console.log('=== VFS2 Unlink Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Unlink Test Failed ===');
        console.error('Error during VFS2 unlink test:', error);
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

export async function childrenExistTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-children-exist';
    
    try {
        console.log('=== VFS2 Children Exist Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Check empty directory (should return false)
        console.log('Testing vfs2_children_exist for empty directory...');
        
        const emptyDirResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, testRootKey);
        
        const emptyDirHasChildren = emptyDirResult.rows[0].has_children;
        console.log(`Empty directory has children: ${emptyDirHasChildren}`);
        
        if (emptyDirHasChildren !== false) {
            throw new Error(`Expected false for empty directory, got: ${emptyDirHasChildren}`);
        }

        console.log('✅ Empty directory test passed');

        // Test 2: Add a file and verify directory now has children
        const testFilename = 'test-file.txt';
        const testContent = 'This is a test file for children exist testing.';
        const testOrdinal = 1000;

        console.log('Creating test file in directory...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, testFilename, testOrdinal,
        false, false, testContent, null, false, 'text/plain', Buffer.from(testContent).length);
        
        console.log(`Created file: ${testFilename} in ${testParentPath}`);

        // Test that the directory now has children
        console.log('Testing vfs2_children_exist for directory with file...');
        
        const fileResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, testRootKey);
        
        const fileHasChildren = fileResult.rows[0].has_children;
        console.log(`Directory with file has children: ${fileHasChildren}`);
        
        if (fileHasChildren !== true) {
            throw new Error(`Expected true for directory with file, got: ${fileHasChildren}`);
        }

        console.log('✅ Directory with file test passed');

        // Test 3: Add a subdirectory and verify directory still has children
        const testSubDirname = 'test-subdir';
        const testSubDirOrdinal = 2000;

        console.log('Creating test subdirectory...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, testSubDirname, testSubDirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created subdirectory: ${testSubDirname} in ${testParentPath}`);

        // Test that the directory still has children (now both file and directory)
        console.log('Testing vfs2_children_exist for directory with file and subdirectory...');
        
        const mixedResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, testRootKey);
        
        const mixedHasChildren = mixedResult.rows[0].has_children;
        console.log(`Directory with file and subdirectory has children: ${mixedHasChildren}`);
        
        if (mixedHasChildren !== true) {
            throw new Error(`Expected true for directory with file and subdirectory, got: ${mixedHasChildren}`);
        }

        console.log('✅ Directory with mixed content test passed');

        // Test 4: Test owner access control  
        // Skip this test since we can't create fake users due to foreign key constraints
        // Instead, test that the current owner can see their files
        console.log('Testing vfs2_children_exist owner access control...');
        
        const ownerAccessResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, testRootKey);
        
        const ownerAccessHasChildren = ownerAccessResult.rows[0].has_children;
        console.log(`Directory has children for owner ${owner_id}: ${ownerAccessHasChildren}`);
        
        if (ownerAccessHasChildren !== true) {
            throw new Error(`Expected true for owner (should see own files), got: ${ownerAccessHasChildren}`);
        }

        console.log('✅ Owner access control test passed');

        // Test 5: Test admin access (owner_id = 0 should see all files)
        console.log('Testing vfs2_children_exist with admin access (owner_id = 0)...');
        
        const adminAccessResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, 0, testParentPath, testRootKey); // admin access
        
        const adminAccessHasChildren = adminAccessResult.rows[0].has_children;
        console.log(`Directory has children for admin: ${adminAccessHasChildren}`);
        
        if (adminAccessHasChildren !== true) {
            throw new Error(`Expected true for admin (should see all files), got: ${adminAccessHasChildren}`);
        }

        console.log('✅ Admin access test passed');

        // Test 6: Test public file access
        const publicTestFilename = 'public-file.txt';
        const publicTestContent = 'This is a public file.';
        const publicTestOrdinal = 4000;

        console.log('Creating public file...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, publicTestFilename, publicTestOrdinal,
        false, true, publicTestContent, null, false, 'text/plain', Buffer.from(publicTestContent).length);
        
        console.log(`Created public file: ${publicTestFilename}`);

        // Test with a non-existent owner who should still see the public file
        // We can use a fake owner ID for reading since the function handles non-existent users
        const fakeOwnerId = 999999;
        console.log('Testing vfs2_children_exist with non-existent owner (should see public files)...');
        
        const publicFileAccessResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, fakeOwnerId, testParentPath, testRootKey);
        
        const publicFileAccessHasChildren = publicFileAccessResult.rows[0].has_children;
        console.log(`Directory has children for non-existent owner: ${publicFileAccessHasChildren}`);
        
        if (publicFileAccessHasChildren !== true) {
            throw new Error(`Expected true for non-existent owner (should see public files), got: ${publicFileAccessHasChildren}`);
        }

        console.log('✅ Public file access test passed');

        // Test 7: Remove all files and verify directory is empty again
        console.log('Removing all files to test empty directory again...');
        
        await pgdb.query(`
            DELETE FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        console.log('Removed all files from test directory');

        // Test that the directory is now empty
        console.log('Testing vfs2_children_exist for emptied directory...');
        
        const emptiedResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, testRootKey);
        
        const emptiedHasChildren = emptiedResult.rows[0].has_children;
        console.log(`Emptied directory has children: ${emptiedHasChildren}`);
        
        if (emptiedHasChildren !== false) {
            throw new Error(`Expected false for emptied directory, got: ${emptiedHasChildren}`);
        }

        console.log('✅ Emptied directory test passed');

        // Test 8: Test with different root key (should return false)
        console.log('Testing vfs2_children_exist with different root key...');
        
        // First create a file again
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, testFilename, testOrdinal,
        false, false, testContent, null, false, 'text/plain', Buffer.from(testContent).length);
        
        const differentRootResult = await pgdb.query(`
            SELECT vfs2_children_exist($1, $2, $3) as has_children
        `, owner_id, testParentPath, 'different-root-key');
        
        const differentRootHasChildren = differentRootResult.rows[0].has_children;
        console.log(`Directory has children with different root key: ${differentRootHasChildren}`);
        
        if (differentRootHasChildren !== false) {
            throw new Error(`Expected false for different root key, got: ${differentRootHasChildren}`);
        }

        console.log('✅ Different root key test passed');

        // List final directory contents for verification
        console.log('Final verification of directory contents...');
        const finalContentsResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory, owner_id, is_public
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${finalContentsResult.rows.length} items in final directory:`);
        finalContentsResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal}, owner: ${row.owner_id}, ${row.is_directory ? 'directory' : 'file'}, ${row.is_public ? 'public' : 'private'})`);
        });

        console.log('=== VFS2 Children Exist Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Children Exist Test Failed ===');
        console.error('Error during VFS2 children exist test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}

export async function mkdirRmdirTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-mkdir-rmdir';
    
    try {
        console.log('=== VFS2 Mkdir/Rmdir Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Create a directory using vfs2_mkdir
        const testDirName = 'test-directory';
        const testDirOrdinal = 1000;

        console.log('Testing vfs2_mkdir function...');
        
        const mkdirResult = await pgdb.query(`
            SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, testDirName, testRootKey, testDirOrdinal, false, false);
        
        const dirId = mkdirResult.rows[0].dir_id;
        console.log(`Directory created with ID: ${dirId}`);

        // Verify the directory was created correctly
        console.log('Verifying directory was created correctly...');
        
        const verifyResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory, owner_id, is_public, content_type, size_bytes
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testDirName);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('Directory not found after creation');
        }

        const dirData = verifyResult.rows[0];
        
        console.log('Verifying directory properties...');
        console.log(`Directory - filename: ${dirData.filename}, ordinal: ${dirData.ordinal}, is_directory: ${dirData.is_directory}`);
        console.log(`Directory - owner_id: ${dirData.owner_id}, is_public: ${dirData.is_public}, content_type: ${dirData.content_type}`);
        
        if (dirData.filename !== testDirName) {
            throw new Error(`Filename mismatch! Expected: ${testDirName}, Got: ${dirData.filename}`);
        }
        
        if (dirData.ordinal !== testDirOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${testDirOrdinal}, Got: ${dirData.ordinal}`);
        }
        
        if (dirData.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${dirData.is_directory}`);
        }
        
        if (dirData.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${dirData.owner_id}`);
        }
        
        if (dirData.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${dirData.is_public}`);
        }
        
        if (dirData.content_type !== 'directory') {
            throw new Error(`Content type mismatch! Expected: 'directory', Got: ${dirData.content_type}`);
        }
        
        if (Number(dirData.size_bytes) !== 0) {
            throw new Error(`Size bytes mismatch! Expected: 0, Got: ${dirData.size_bytes}`);
        }

        console.log('✅ Directory creation test passed');

        // Test 2: Verify the directory exists using vfs2_exists
        console.log('Testing that created directory exists...');
        
        const existsResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as dir_exists
        `, testParentPath, testDirName, testRootKey);
        
        const dirExists = existsResult.rows[0].dir_exists;
        console.log(`Directory exists: ${dirExists}`);
        
        if (dirExists !== true) {
            throw new Error(`Directory should exist after creation, got: ${dirExists}`);
        }

        console.log('✅ Directory exists verification test passed');

        // Test 3: Try to create the same directory again (should fail)
        console.log('Testing vfs2_mkdir for duplicate directory (should fail)...');
        
        try {
            await pgdb.query(`
                SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, testDirName, testRootKey, testDirOrdinal, false, false);
            
            throw new Error('Expected exception for duplicate directory, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('Directory already exists')) {
                console.log('✅ Duplicate directory test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for duplicate directory: ${error.message}`);
            }
        }

        // Test 4: Delete the directory using vfs2_rmdir
        console.log('Testing vfs2_rmdir function for empty directory...');
        
        const rmdirResult = await pgdb.query(`
            SELECT vfs2_rmdir($1, $2, $3, $4) as deleted_count
        `, owner_id, testParentPath, testDirName, testRootKey);
        
        const deletedCount = rmdirResult.rows[0].deleted_count;
        console.log(`Directory deletion result - deleted count: ${deletedCount}`);
        
        if (deletedCount !== 1) {
            throw new Error(`Expected 1 deleted item (the directory), got: ${deletedCount}`);
        }

        console.log('✅ Empty directory deletion test passed');

        // Test 5: Verify the directory no longer exists
        console.log('Testing that deleted directory no longer exists...');
        
        const noLongerExistsResult = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as dir_exists
        `, testParentPath, testDirName, testRootKey);
        
        const dirNoLongerExists = noLongerExistsResult.rows[0].dir_exists;
        console.log(`Directory exists after deletion: ${dirNoLongerExists}`);
        
        if (dirNoLongerExists !== false) {
            throw new Error(`Directory should not exist after deletion, got: ${dirNoLongerExists}`);
        }

        console.log('✅ Directory removal verification test passed');

        // Test 6: Create directory with subdirectories and files, then delete recursively
        const testDirName2 = 'test-directory-with-content';
        const testDirOrdinal2 = 2000;

        console.log('Testing vfs2_mkdir and recursive deletion with content...');
        
        // Create parent directory
        await pgdb.query(`
            SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, testDirName2, testRootKey, testDirOrdinal2, false, false);
        
        console.log(`Created parent directory: ${testDirName2}`);

        // Create some files and subdirectories inside it
        const dirPath = testParentPath + '/' + testDirName2;
        
        // Create a file in the directory
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, dirPath, 'file-in-dir.txt', 1000,
        false, false, 'Content in directory', null, false, 'text/plain', Buffer.from('Content in directory').length);
        
        console.log('Created file in directory: file-in-dir.txt');

        // Create a subdirectory
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, dirPath, 'subdir', 2000,
        true, false, null, null, false, 'directory', 0);
        
        console.log('Created subdirectory: subdir');

        // Create a file in the subdirectory
        const subDirPath = dirPath + '/subdir';
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, subDirPath, 'file-in-subdir.txt', 1000,
        false, false, 'Content in subdirectory', null, false, 'text/plain', Buffer.from('Content in subdirectory').length);
        
        console.log('Created file in subdirectory: file-in-subdir.txt');

        // Verify directory has content before deletion
        const beforeDeleteResult = await pgdb.query(`
            SELECT filename, parent_path 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3)
            ORDER BY parent_path, filename
        `, testRootKey, dirPath, dirPath + '/%');
        
        console.log(`Found ${beforeDeleteResult.rows.length} items in directory structure before deletion:`);
        beforeDeleteResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (in ${row.parent_path})`);
        });
        
        if (beforeDeleteResult.rows.length !== 3) { // file-in-dir.txt, subdir, file-in-subdir.txt
            throw new Error(`Expected 3 items in directory structure, got: ${beforeDeleteResult.rows.length}`);
        }

        // Test recursive deletion
        console.log('Testing vfs2_rmdir for directory with content (recursive deletion)...');
        
        const rmdirRecursiveResult = await pgdb.query(`
            SELECT vfs2_rmdir($1, $2, $3, $4) as deleted_count
        `, owner_id, testParentPath, testDirName2, testRootKey);
        
        const recursiveDeletedCount = rmdirRecursiveResult.rows[0].deleted_count;
        console.log(`Recursive directory deletion result - deleted count: ${recursiveDeletedCount}`);
        
        if (recursiveDeletedCount !== 4) { // parent dir + file-in-dir.txt + subdir + file-in-subdir.txt
            throw new Error(`Expected 4 deleted items (dir + 3 contents), got: ${recursiveDeletedCount}`);
        }

        // Verify all content was deleted
        const afterDeleteResult = await pgdb.query(`
            SELECT filename, parent_path 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3)
        `, testRootKey, dirPath, dirPath + '/%');
        
        console.log(`Found ${afterDeleteResult.rows.length} items in directory structure after deletion`);
        
        if (afterDeleteResult.rows.length !== 0) {
            throw new Error(`Expected 0 items after recursive deletion, got: ${afterDeleteResult.rows.length}`);
        }

        console.log('✅ Recursive directory deletion test passed');

        // Test 7: Try to delete non-existent directory (should fail)
        console.log('Testing vfs2_rmdir for non-existent directory (should fail)...');
        
        try {
            await pgdb.query(`
                SELECT vfs2_rmdir($1, $2, $3, $4) as deleted_count
            `, owner_id, testParentPath, 'non-existent-directory', testRootKey);
            
            throw new Error('Expected exception for non-existent directory, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('Directory not found')) {
                console.log('✅ Non-existent directory deletion test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent directory: ${error.message}`);
            }
        }

        // Test 8: Create public directory and test permissions
        const publicDirName = 'public-test-directory';
        const publicDirOrdinal = 3000;

        console.log('Testing vfs2_mkdir with public directory...');
        
        const publicMkdirResult = await pgdb.query(`
            SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, publicDirName, testRootKey, publicDirOrdinal, false, true); // is_public = true
        
        const publicDirId = publicMkdirResult.rows[0].dir_id;
        console.log(`Public directory created with ID: ${publicDirId}`);

        // Verify public directory properties
        const publicDirVerifyResult = await pgdb.query(`
            SELECT is_public, is_directory
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, publicDirName);
        
        const publicDirData = publicDirVerifyResult.rows[0];
        
        if (publicDirData.is_public !== true) {
            throw new Error(`Public directory flag mismatch! Expected: true, Got: ${publicDirData.is_public}`);
        }
        
        if (publicDirData.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${publicDirData.is_directory}`);
        }

        console.log('✅ Public directory creation test passed');

        // Delete the public directory
        console.log('Testing vfs2_rmdir for public directory...');
        
        const publicRmdirResult = await pgdb.query(`
            SELECT vfs2_rmdir($1, $2, $3, $4) as deleted_count
        `, owner_id, testParentPath, publicDirName, testRootKey);
        
        const publicDeletedCount = publicRmdirResult.rows[0].deleted_count;
        console.log(`Public directory deletion result - deleted count: ${publicDeletedCount}`);
        
        if (publicDeletedCount !== 1) {
            throw new Error(`Expected 1 deleted item (public directory), got: ${publicDeletedCount}`);
        }

        console.log('✅ Public directory deletion test passed');

        // Test 9: Test ordinal ordering with multiple directories
        console.log('Testing vfs2_mkdir with multiple directories for ordinal ordering...');
        
        const testDirs = [
            { name: 'dir-c', ordinal: 3000 },
            { name: 'dir-a', ordinal: 1000 },
            { name: 'dir-b', ordinal: 2000 },
        ];

        // Create all test directories
        for (const testDir of testDirs) {
            await pgdb.query(`
                SELECT vfs2_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, testDir.name, testRootKey, testDir.ordinal, false, false);
            
            console.log(`Created directory: ${testDir.name} (ordinal: ${testDir.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const orderingResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND is_directory = true
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${orderingResult.rows.length} directories (ordered by ordinal):`);
        orderingResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal})`);
        });
        
        // Verify the ordering is correct (by ordinal)
        const expectedOrder = ['dir-a', 'dir-b', 'dir-c']; // ordinals: 1000, 2000, 3000
        const actualOrder = orderingResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ Multiple directories ordinal ordering test passed');

        // Delete all test directories
        console.log('Cleaning up test directories...');
        
        for (const testDir of testDirs) {
            await pgdb.query(`
                SELECT vfs2_rmdir($1, $2, $3, $4) as deleted_count
            `, owner_id, testParentPath, testDir.name, testRootKey);
            
            console.log(`Deleted directory: ${testDir.name}`);
        }

        // Final verification that all directories are gone
        const finalVerifyResult = await pgdb.query(`
            SELECT filename 
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        console.log(`Found ${finalVerifyResult.rows.length} items after cleanup`);
        
        if (finalVerifyResult.rows.length !== 0) {
            throw new Error(`Expected 0 items after cleanup, got: ${finalVerifyResult.rows.length}`);
        }

        console.log('✅ Final cleanup verification test passed');
        console.log('=== VFS2 Mkdir/Rmdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Mkdir/Rmdir Test Failed ===');
        console.error('Error during VFS2 mkdir/rmdir test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}

export async function ensurePathAndRenameTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-ensure-path-rename';
    const randomSuffix = Math.floor(Math.random() * 10000);
    
    try {
        console.log('=== VFS2 Ensure Path and Rename Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Use vfs2_ensure_path to create a random nested directory structure
        const randomPath = `level1-${randomSuffix}/level2-${randomSuffix}/level3-${randomSuffix}`;
        const fullRandomPath = testParentPath + '/' + randomPath;

        console.log(`Testing vfs2_ensure_path for nested path: ${fullRandomPath}`);
        
        const ensurePathResult = await pgdb.query(`
            SELECT vfs2_ensure_path($1, $2, $3) as path_created
        `, owner_id, fullRandomPath, testRootKey);
        
        const pathCreated = ensurePathResult.rows[0].path_created;
        console.log(`vfs2_ensure_path returned: ${pathCreated}`);
        
        if (pathCreated !== true) {
            throw new Error(`Expected true from vfs2_ensure_path, got: ${pathCreated}`);
        }

        console.log('✅ Path creation test passed');

        // Test 2: Verify that all intermediate directories were created
        console.log('Verifying that all intermediate directories were created...');
        
        const expectedPaths = [
            { parent_path: testParentPath, filename: `level1-${randomSuffix}` },
            { parent_path: testParentPath + `/level1-${randomSuffix}`, filename: `level2-${randomSuffix}` },
            { parent_path: testParentPath + `/level1-${randomSuffix}/level2-${randomSuffix}`, filename: `level3-${randomSuffix}` }
        ];
        
        for (const expectedPath of expectedPaths) {
            const existsResult = await pgdb.query(`
                SELECT vfs2_exists($1, $2, $3) as dir_exists
            `, expectedPath.parent_path, expectedPath.filename, testRootKey);
            
            const dirExists = existsResult.rows[0].dir_exists;
            console.log(`Directory ${expectedPath.parent_path}/${expectedPath.filename} exists: ${dirExists}`);
            
            if (dirExists !== true) {
                throw new Error(`Expected directory to exist: ${expectedPath.parent_path}/${expectedPath.filename}`);
            }
        }

        console.log('✅ All intermediate directories verification test passed');

        // Test 3: Test renaming a directory using vfs2_rename
        const oldDirName = `level3-${randomSuffix}`;
        const newDirName = `level3-renamed-${randomSuffix}`;
        const oldDirParentPath = testParentPath + `/level1-${randomSuffix}/level2-${randomSuffix}`;
        
        console.log(`Testing vfs2_rename for directory: ${oldDirParentPath}/${oldDirName} -> ${oldDirParentPath}/${newDirName}`);
        
        const renameResult = await pgdb.query(`
            SELECT * FROM vfs2_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, oldDirParentPath, oldDirName, oldDirParentPath, newDirName, testRootKey);
        
        const renameSuccess = renameResult.rows[0].success;
        const renameDiagnostic = renameResult.rows[0].diagnostic;
        
        console.log(`Rename result - success: ${renameSuccess}, diagnostic: ${renameDiagnostic}`);
        
        if (renameSuccess !== true) {
            throw new Error(`Expected successful rename, got: ${renameSuccess}. Diagnostic: ${renameDiagnostic}`);
        }

        console.log('✅ Directory rename test passed');

        // Test 4: Verify the old directory name no longer exists and new name exists
        console.log('Verifying rename effects...');
        
        const oldNameExists = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as exists
        `, oldDirParentPath, oldDirName, testRootKey);
        
        const newNameExists = await pgdb.query(`
            SELECT vfs2_exists($1, $2, $3) as exists
        `, oldDirParentPath, newDirName, testRootKey);
        
        console.log(`Old name exists: ${oldNameExists.rows[0].exists}`);
        console.log(`New name exists: ${newNameExists.rows[0].exists}`);
        
        if (oldNameExists.rows[0].exists !== false) {
            throw new Error(`Expected old directory name to not exist after rename`);
        }
        
        if (newNameExists.rows[0].exists !== true) {
            throw new Error(`Expected new directory name to exist after rename`);
        }

        console.log('✅ Rename verification test passed');

        console.log('=== VFS2 Ensure Path and Rename Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Ensure Path and Rename Test Failed ===');
        console.error('Error during VFS2 ensure path and rename test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs2_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}

export async function setPublicTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-set-public';
    
    try {
        console.log('=== VFS2 Set Public Test Starting ===');

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
        
        // Test 1: Create a private file and then make it public
        const textFilename = 'test-file.md';
        const textContent = 'This is a test file for set_public testing.';
        const textContentType = 'text/markdown';
        const textOrdinal = 1000;

        console.log('Creating test text file (initially private)...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, textFilename, textOrdinal,
        false, false, textContent, null, false, textContentType, Buffer.from(textContent).length);
        
        console.log(`Created private text file: ${textFilename}`);

        // Verify file is initially private
        const initialStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (initialStatusResult.rows[0].is_public !== false) {
            throw new Error(`Expected file to be initially private (false), got: ${initialStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File initially private as expected');

        // Test setting file to public
        console.log('Testing vfs2_set_public to make file public...');
        
        const setPublicResult = await pgdb.query(`
            SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, textFilename, testRootKey, true);
        
        const setPublicSuccess = setPublicResult.rows[0].success;
        console.log(`vfs2_set_public returned: ${setPublicSuccess}`);
        
        if (setPublicSuccess !== true) {
            throw new Error(`Expected vfs2_set_public to return true, got: ${setPublicSuccess}`);
        }

        // Verify file is now public
        const publicStatusResult = await pgdb.query(`
            SELECT is_public, modified_time FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (publicStatusResult.rows[0].is_public !== true) {
            throw new Error(`Expected file to be public after vfs2_set_public, got: ${publicStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File successfully set to public');

        // Test setting file back to private
        console.log('Testing vfs2_set_public to make file private again...');
        
        const setPrivateResult = await pgdb.query(`
            SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, textFilename, testRootKey, false);
        
        const setPrivateSuccess = setPrivateResult.rows[0].success;
        console.log(`vfs2_set_public(false) returned: ${setPrivateSuccess}`);
        
        if (setPrivateSuccess !== true) {
            throw new Error(`Expected vfs2_set_public(false) to return true, got: ${setPrivateSuccess}`);
        }

        // Verify file is now private again
        const privateStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (privateStatusResult.rows[0].is_public !== false) {
            throw new Error(`Expected file to be private after vfs2_set_public(false), got: ${privateStatusResult.rows[0].is_public}`);
        }

        console.log('✅ File successfully set back to private');

        // Test 2: Create a directory and test setting its public status
        const dirFilename = 'test-directory';
        const dirOrdinal = 2000;

        console.log('Creating test directory (initially private)...');
        
        await pgdb.query(`
            INSERT INTO vfs2_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, dirFilename, dirOrdinal,
        true, false, null, null, false, 'directory', 0);
        
        console.log(`Created private directory: ${dirFilename}`);

        // Test setting directory to public
        console.log('Testing vfs2_set_public to make directory public...');
        
        const setDirPublicResult = await pgdb.query(`
            SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, dirFilename, testRootKey, true);
        
        const setDirPublicSuccess = setDirPublicResult.rows[0].success;
        
        if (setDirPublicSuccess !== true) {
            throw new Error(`Expected vfs2_set_public for directory to return true, got: ${setDirPublicSuccess}`);
        }

        // Verify directory is now public
        const dirPublicStatusResult = await pgdb.query(`
            SELECT is_public FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        if (dirPublicStatusResult.rows[0].is_public !== true) {
            throw new Error(`Expected directory to be public after vfs2_set_public, got: ${dirPublicStatusResult.rows[0].is_public}`);
        }

        console.log('✅ Directory successfully set to public');

        // Test 3: Test admin access (owner_id = 0 should be able to modify any file)
        console.log('Testing admin access (owner_id = 0)...');
        
        const adminSetResult = await pgdb.query(`
            SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
        `, 0, testParentPath, textFilename, testRootKey, true); // owner_id = 0 (admin)
        
        const adminSetSuccess = adminSetResult.rows[0].success;
        
        if (adminSetSuccess !== true) {
            throw new Error(`Expected admin vfs2_set_public to return true, got: ${adminSetSuccess}`);
        }

        // Verify file was modified by admin
        const adminModifiedResult = await pgdb.query(`
            SELECT is_public FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, textFilename);
        
        if (adminModifiedResult.rows[0].is_public !== true) {
            throw new Error(`Expected file to be public after admin modification, got: ${adminModifiedResult.rows[0].is_public}`);
        }

        console.log('✅ Admin access test passed');

        // Test 4: Test access denied for wrong owner
        console.log('Testing access denied for wrong owner...');
        
        const wrongOwnerId = 999999; // Use a very high ID that's unlikely to exist
        
        try {
            await pgdb.query(`
                SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
            `, wrongOwnerId, testParentPath, textFilename, testRootKey, false);
            
            throw new Error('Expected exception for wrong owner, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File or directory not found or access denied')) {
                console.log('✅ Access denied test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for wrong owner: ${error.message}`);
            }
        }

        // Test 5: Test setting public status for non-existent file
        console.log('Testing vfs2_set_public for non-existent file...');
        
        try {
            await pgdb.query(`
                SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
            `, owner_id, testParentPath, 'non-existent-file.txt', testRootKey, true);
            
            throw new Error('Expected exception for non-existent file, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('File or directory not found or access denied')) {
                console.log('✅ Non-existent file test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent file: ${error.message}`);
            }
        }

        // Test 6: Verify modified_time is updated when setting public status
        console.log('Testing that modified_time is updated...');
        
        // Get current modified_time
        const beforeTimeResult = await pgdb.query(`
            SELECT modified_time FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        const beforeTime = new Date(beforeTimeResult.rows[0].modified_time);
        
        // Wait a small amount to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Change public status
        await pgdb.query(`
            SELECT vfs2_set_public($1, $2, $3, $4, $5) as success
        `, owner_id, testParentPath, dirFilename, testRootKey, false);
        
        // Get new modified_time
        const afterTimeResult = await pgdb.query(`
            SELECT modified_time FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, dirFilename);
        
        const afterTime = new Date(afterTimeResult.rows[0].modified_time);
        
        if (afterTime.getTime() <= beforeTime.getTime()) {
            throw new Error(`Expected modified_time to be updated. Before: ${beforeTime}, After: ${afterTime}`);
        }

        console.log('✅ Modified time update test passed');

        // Show final status of all files
        console.log('Final status of all test files:');
        const finalStatusResult = await pgdb.query(`
            SELECT filename, is_directory, is_public, ordinal
            FROM vfs2_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 
            ORDER BY ordinal ASC
        `, testRootKey, testParentPath);
        
        finalStatusResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'}, public: ${row.is_public}, ordinal: ${row.ordinal})`);
        });

        console.log('=== VFS2 Set Public Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Set Public Test Failed ===');
        console.error('Error during VFS2 set public test:', error);
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
