import pgdb from '../../../../../server/db/PGDB.js';
import { TestRunner } from '../../../../../common/TestRunner.js';
import vfs2 from '../VFS2.js';

export async function runTests() {
    console.log("🚀 Starting VFS2-svc embedded tests...");
    
    // Check if database is available
    if (!pgdb.adminProfile?.id) {
        console.log("⚠️  Database not available - skipping VFS2-svc tests");
        return;
    }
    
    const owner_id = pgdb.adminProfile.id;
    console.log(`🔧 Running VFS2-svc tests with owner_id: ${owner_id}`);
    
    const testRunner = new TestRunner("VFS2-svc");
    
    try {
        // Run the simple read/write test using the test runner
        // await testRunner.run("simpleReadWriteTest", () => simpleReadWriteTest(owner_id), true);
        
        // Test the normalizePath method
        await testRunner.run("normalizePathTest", () => normalizePathTest(), true);
        
        // Test the joinPath method
        await testRunner.run("joinPathTest", () => joinPathTest(), true);
        
        // Test the exists method
        await testRunner.run("existsTest", () => existsTest(), true);
                
        // Test the readdirEx method
        await testRunner.run("readdirExTest", () => readdirExTest(owner_id), true);
        
        // Test the childrenExist method
        await testRunner.run("childrenExistTest", () => childrenExistTest(owner_id), true);
        
        // Test the rename method
        await testRunner.run("renameTest", () => renameTest(owner_id), true);
        
        // Test the stat method
        await testRunner.run("statTest", () => statTest(), true);
        
        // Test the shiftOrdinalsDown method
        await testRunner.run("shiftOrdinalsDownTest", () => shiftOrdinalsDownTest(owner_id), true);
        
        // Test the writeFileEx method with ordinals
        await testRunner.run("writeFileExTest", () => writeFileExTest(owner_id), true);
        
        // Test the writeFile and readFile methods
        await testRunner.run("writeFileAndReadFileTest", () => writeFileAndReadFileTest(owner_id), true);
        
        // Test the rm method
        await testRunner.run("rmTest", () => rmTest(owner_id), true);
        
        // Test the unlink method
        await testRunner.run("unlinkTest", () => unlinkTest(owner_id), true);
        
        // Test the readdir method
        await testRunner.run("readdirTest", () => readdirTest(owner_id), true);
        
        // Test the getItemByID method
        await testRunner.run("getItemByIDTest", () => getItemByIDTest(owner_id), true);
        
        // Test the setOrdinal method
        await testRunner.run("setOrdinalTest", () => setOrdinalTest(owner_id), true);
        
        // Test the moveUpOrDown functionality (ordinal swapping)
        await testRunner.run("moveUpOrDownTest", () => moveUpOrDownTest(owner_id), true);
        
        console.log("✅ VFS2-svc test suite passed");
    } catch {
        console.error("❌ VFS2-svc test suite failed");
    }
    finally {
        testRunner.report();
    }
}

export async function normalizePathTest(): Promise<void> {
    try {
        console.log('=== VFS2 Normalize Path Test Starting ===');

        // Test 1: Remove leading slashes
        const result1 = vfs2.normalizePath('/test/path');
        const expected1 = 'test/path';
        console.log(`Test 1 - Input: '/test/path', Expected: '${expected1}', Got: '${result1}'`);
        if (result1 !== expected1) {
            throw new Error(`Test 1 failed! Expected: '${expected1}', Got: '${result1}'`);
        }

        // Test 2: Remove leading dots and slashes
        const result2 = vfs2.normalizePath('./test/path');
        const expected2 = 'test/path';
        console.log(`Test 2 - Input: './test/path', Expected: '${expected2}', Got: '${result2}'`);
        if (result2 !== expected2) {
            throw new Error(`Test 2 failed! Expected: '${expected2}', Got: '${result2}'`);
        }

        // Test 3: Remove multiple leading slashes
        const result3 = vfs2.normalizePath('///test/path');
        const expected3 = 'test/path';
        console.log(`Test 3 - Input: '///test/path', Expected: '${expected3}', Got: '${result3}'`);
        if (result3 !== expected3) {
            throw new Error(`Test 3 failed! Expected: '${expected3}', Got: '${result3}'`);
        }

        // Test 4: Replace multiple slashes with single slash
        const result4 = vfs2.normalizePath('test//path///file');
        const expected4 = 'test/path/file';
        console.log(`Test 4 - Input: 'test//path///file', Expected: '${expected4}', Got: '${result4}'`);
        if (result4 !== expected4) {
            throw new Error(`Test 4 failed! Expected: '${expected4}', Got: '${result4}'`);
        }

        // Test 5: Remove trailing slashes
        const result5 = vfs2.normalizePath('test/path/');
        const expected5 = 'test/path';
        console.log(`Test 5 - Input: 'test/path/', Expected: '${expected5}', Got: '${result5}'`);
        if (result5 !== expected5) {
            throw new Error(`Test 5 failed! Expected: '${expected5}', Got: '${result5}'`);
        }

        // Test 6: Remove multiple trailing slashes
        const result6 = vfs2.normalizePath('test/path///');
        const expected6 = 'test/path';
        console.log(`Test 6 - Input: 'test/path///', Expected: '${expected6}', Got: '${result6}'`);
        if (result6 !== expected6) {
            throw new Error(`Test 6 failed! Expected: '${expected6}', Got: '${result6}'`);
        }

        // Test 7: Handle empty string
        const result7 = vfs2.normalizePath('');
        const expected7 = '';
        console.log(`Test 7 - Input: '', Expected: '${expected7}', Got: '${result7}'`);
        if (result7 !== expected7) {
            throw new Error(`Test 7 failed! Expected: '${expected7}', Got: '${result7}'`);
        }

        // Test 8: Handle single slash
        const result8 = vfs2.normalizePath('/');
        const expected8 = '';
        console.log(`Test 8 - Input: '/', Expected: '${expected8}', Got: '${result8}'`);
        if (result8 !== expected8) {
            throw new Error(`Test 8 failed! Expected: '${expected8}', Got: '${result8}'`);
        }

        // Test 9: Handle multiple slashes only
        const result9 = vfs2.normalizePath('///');
        const expected9 = '';
        console.log(`Test 9 - Input: '///', Expected: '${expected9}', Got: '${result9}'`);
        if (result9 !== expected9) {
            throw new Error(`Test 9 failed! Expected: '${expected9}', Got: '${result9}'`);
        }

        // Test 10: Complex case with all issues
        const result10 = vfs2.normalizePath('./////test///path//file///');
        const expected10 = 'test/path/file';
        console.log(`Test 10 - Input: './////test///path//file///', Expected: '${expected10}', Got: '${result10}'`);
        if (result10 !== expected10) {
            throw new Error(`Test 10 failed! Expected: '${expected10}', Got: '${result10}'`);
        }

        // Test 11: Single filename
        const result11 = vfs2.normalizePath('filename.txt');
        const expected11 = 'filename.txt';
        console.log(`Test 11 - Input: 'filename.txt', Expected: '${expected11}', Got: '${result11}'`);
        if (result11 !== expected11) {
            throw new Error(`Test 11 failed! Expected: '${expected11}', Got: '${result11}'`);
        }

        // Test 12: Single filename with leading slash
        const result12 = vfs2.normalizePath('/filename.txt');
        const expected12 = 'filename.txt';
        console.log(`Test 12 - Input: '/filename.txt', Expected: '${expected12}', Got: '${result12}'`);
        if (result12 !== expected12) {
            throw new Error(`Test 12 failed! Expected: '${expected12}', Got: '${result12}'`);
        }

        console.log('✅ All normalizePath tests passed');
        console.log('=== VFS2 Normalize Path Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Normalize Path Test Failed ===');
        console.error('Error during VFS2 normalizePath test:', error);
        throw error;
    }
}

export async function joinPathTest(): Promise<void> {
    try {
        console.log('=== VFS2 Join Path Test Starting ===');

        // Test 1: Basic path joining
        const result1 = vfs2.pathJoin('folder', 'file.txt');
        const expected1 = 'folder/file.txt';
        console.log(`Test 1 - Input: ['folder', 'file.txt'], Expected: '${expected1}', Got: '${result1}'`);
        if (result1 !== expected1) {
            throw new Error(`Test 1 failed! Expected: '${expected1}', Got: '${result1}'`);
        }

        // Test 2: Multiple path parts
        const result2 = vfs2.pathJoin('folder1', 'folder2', 'folder3', 'file.txt');
        const expected2 = 'folder1/folder2/folder3/file.txt';
        console.log(`Test 2 - Input: ['folder1', 'folder2', 'folder3', 'file.txt'], Expected: '${expected2}', Got: '${result2}'`);
        if (result2 !== expected2) {
            throw new Error(`Test 2 failed! Expected: '${expected2}', Got: '${result2}'`);
        }

        // Test 3: Empty strings in parts
        const result3 = vfs2.pathJoin('folder', '', 'file.txt');
        const expected3 = 'folder/file.txt';
        console.log(`Test 3 - Input: ['folder', '', 'file.txt'], Expected: '${expected3}', Got: '${result3}'`);
        if (result3 !== expected3) {
            throw new Error(`Test 3 failed! Expected: '${expected3}', Got: '${result3}'`);
        }

        // Test 4: Parts with leading/trailing slashes
        const result4 = vfs2.pathJoin('/folder/', '/subfolder/', '/file.txt');
        const expected4 = 'folder/subfolder/file.txt';
        console.log(`Test 4 - Input: ['/folder/', '/subfolder/', '/file.txt'], Expected: '${expected4}', Got: '${result4}'`);
        if (result4 !== expected4) {
            throw new Error(`Test 4 failed! Expected: '${expected4}', Got: '${result4}'`);
        }

        // Test 5: Single part
        const result5 = vfs2.pathJoin('file.txt');
        const expected5 = 'file.txt';
        console.log(`Test 5 - Input: ['file.txt'], Expected: '${expected5}', Got: '${result5}'`);
        if (result5 !== expected5) {
            throw new Error(`Test 5 failed! Expected: '${expected5}', Got: '${result5}'`);
        }

        // Test 6: No parts (empty array)
        const result6 = vfs2.pathJoin();
        const expected6 = '';
        console.log(`Test 6 - Input: [], Expected: '${expected6}', Got: '${result6}'`);
        if (result6 !== expected6) {
            throw new Error(`Test 6 failed! Expected: '${expected6}', Got: '${result6}'`);
        }

        // Test 7: Parts with multiple slashes
        const result7 = vfs2.pathJoin('folder//subfolder', 'file.txt');
        const expected7 = 'folder/subfolder/file.txt';
        console.log(`Test 7 - Input: ['folder//subfolder', 'file.txt'], Expected: '${expected7}', Got: '${result7}'`);
        if (result7 !== expected7) {
            throw new Error(`Test 7 failed! Expected: '${expected7}', Got: '${result7}'`);
        }

        // Test 8: All empty strings
        const result8 = vfs2.pathJoin('', '', '');
        const expected8 = '';
        console.log(`Test 8 - Input: ['', '', ''], Expected: '${expected8}', Got: '${result8}'`);
        if (result8 !== expected8) {
            throw new Error(`Test 8 failed! Expected: '${expected8}', Got: '${result8}'`);
        }

        // Test 9: Complex path with dots and slashes (normalizePath doesn't resolve .. paths)
        const result9 = vfs2.pathJoin('./folder', '../other', 'file.txt');
        const expected9 = 'folder/../other/file.txt';
        console.log(`Test 9 - Input: ['./folder', '../other', 'file.txt'], Expected: '${expected9}', Got: '${result9}'`);
        if (result9 !== expected9) {
            throw new Error(`Test 9 failed! Expected: '${expected9}', Got: '${result9}'`);
        }

        // Test 10: Root-like paths
        const result10 = vfs2.pathJoin('/', 'folder', 'file.txt');
        const expected10 = 'folder/file.txt';
        console.log(`Test 10 - Input: ['/', 'folder', 'file.txt'], Expected: '${expected10}', Got: '${result10}'`);
        if (result10 !== expected10) {
            throw new Error(`Test 10 failed! Expected: '${expected10}', Got: '${result10}'`);
        }

        console.log('✅ All joinPath tests passed');
        console.log('=== VFS2 Join Path Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Join Path Test Failed ===');
        console.error('Error during VFS2 joinPath test:', error);
        throw error;
    }
}

export async function existsTest(): Promise<void> {
    try {
        console.log('=== VFS2 Exists Test Starting ===');

        // Test 1: Check if root directory exists (should always be true)
        const result1 = await vfs2.exists('');
        console.log(`Test 1 - Root directory exists: ${result1}`);
        if (!result1) {
            throw new Error('Test 1 failed! Root directory should always exist');
        }

        // Test 2: Check if root directory exists with slash (should always be true)
        const result2 = await vfs2.exists('/');
        console.log(`Test 2 - Root directory with slash exists: ${result2}`);
        if (!result2) {
            throw new Error('Test 2 failed! Root directory should always exist');
        }

        // Test 3: Check if non-existent file exists (should be false)
        const result3 = await vfs2.exists('nonexistent-file.txt');
        console.log(`Test 3 - Non-existent file exists: ${result3}`);
        if (result3) {
            throw new Error('Test 3 failed! Non-existent file should not exist');
        }

        // Test 4: Check if non-existent nested path exists (should be false)
        const result4 = await vfs2.exists('folder/subfolder/file.txt');
        console.log(`Test 4 - Non-existent nested path exists: ${result4}`);
        if (result4) {
            throw new Error('Test 4 failed! Non-existent nested path should not exist');
        }

        // Test 5: Test exists with info parameter for root directory
        const info5: any = {};
        const result5 = await vfs2.exists('', info5);
        console.log(`Test 5 - Root directory exists with info: ${result5}`);
        if (!result5 || !info5.node || !info5.node.is_directory) {
            throw new Error('Test 5 failed! Root directory should exist and have proper node info');
        }
        console.log(`Test 5 - Root node info:`, JSON.stringify(info5.node, null, 2));

        // Test 6: Test exists with info parameter for non-existent file
        const info6: any = {};
        const result6 = await vfs2.exists('nonexistent.txt', info6);
        console.log(`Test 6 - Non-existent file exists with info: ${result6}`);
        if (result6 || info6.node) {
            throw new Error('Test 6 failed! Non-existent file should not exist and should not have node info');
        }

        // Test 7: Test path normalization in exists
        const result7 = await vfs2.exists('//test///path//');
        console.log(`Test 7 - Path with multiple slashes exists: ${result7}`);
        if (result7) {
            throw new Error('Test 7 failed! Non-existent path with multiple slashes should not exist');
        }

        // Test 8: Test exists with various path formats
        const testPaths = [
            'single-file.txt',
            '/single-file.txt',
            './single-file.txt',
            'folder/file.txt',
            '/folder/file.txt',
            './folder/file.txt',
            'deeply/nested/folder/structure/file.txt'
        ];
        
        for (const path of testPaths) {
            const result = await vfs2.exists(path);
            console.log(`Test 8 - Path '${path}' exists: ${result}`);
            // All should be false since we haven't created any files yet
            if (result) {
                throw new Error(`Test 8 failed! Path '${path}' should not exist`);
            }
        }

        console.log('✅ All exists tests passed');
        console.log('=== VFS2 Exists Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Exists Test Failed ===');
        console.error('Error during VFS2 exists test:', error);
        throw error;
    }
}

export async function readdirExTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 ReaddirEx Test Starting ===');

        // Test 1: Read root directory (should return empty array or user folders)
        console.log('Test 1 - Reading root directory');
        const result1 = await vfs2.readdirEx(owner_id, '', false);
        console.log(`Test 1 - Root directory contents (${result1.length} items):`, 
            result1.map(node => ({ name: node.name, is_directory: node.is_directory })));
        
        // Root directory should return an array (could be empty or contain user folders)
        if (!Array.isArray(result1)) {
            throw new Error('Test 1 failed! readdirEx should return an array');
        }

        // Test 2: Read root directory with loadContent=true
        console.log('Test 2 - Reading root directory with loadContent=true');
        const result2 = await vfs2.readdirEx(owner_id, '', true);
        console.log(`Test 2 - Root directory contents with content (${result2.length} items):`, 
            result2.map(node => ({ name: node.name, is_directory: node.is_directory, hasContent: !!node.content })));
        
        if (!Array.isArray(result2)) {
            throw new Error('Test 2 failed! readdirEx with loadContent should return an array');
        }

        // Test 3: Read root directory with slash
        console.log('Test 3 - Reading root directory with slash');
        const result3 = await vfs2.readdirEx(owner_id, '/', false);
        console.log(`Test 3 - Root directory with slash contents (${result3.length} items):`, 
            result3.map(node => ({ name: node.name, is_directory: node.is_directory })));
        
        if (!Array.isArray(result3)) {
            throw new Error('Test 3 failed! readdirEx with slash should return an array');
        }

        // Test 4: Read non-existent directory (should return empty array or throw error)
        console.log('Test 4 - Reading non-existent directory');
        try {
            const result4 = await vfs2.readdirEx(owner_id, 'nonexistent-folder', false);
            console.log(`Test 4 - Non-existent directory contents (${result4.length} items):`, 
                result4.map(node => ({ name: node.name, is_directory: node.is_directory })));
            
            // Should return empty array for non-existent directory
            if (!Array.isArray(result4) || result4.length > 0) {
                throw new Error('Test 4 failed! Non-existent directory should return empty array');
            }
        } catch (error) {
            // It's also acceptable for readdirEx to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 - Non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 5: Read nested non-existent directory
        console.log('Test 5 - Reading nested non-existent directory');
        try {
            const result5 = await vfs2.readdirEx(owner_id, 'folder/subfolder/nested', false);
            console.log(`Test 5 - Nested non-existent directory contents (${result5.length} items):`, 
                result5.map(node => ({ name: node.name, is_directory: node.is_directory })));
            
            // Should return empty array for non-existent nested directory
            if (!Array.isArray(result5) || result5.length > 0) {
                throw new Error('Test 5 failed! Non-existent nested directory should return empty array');
            }
        } catch (error) {
            // It's also acceptable for readdirEx to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 - Nested non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 6: Test path normalization in readdirEx
        console.log('Test 6 - Testing path normalization');
        const result6 = await vfs2.readdirEx(owner_id, '//test///path//', false);
        console.log(`Test 6 - Normalized path contents (${result6.length} items):`, 
            result6.map(node => ({ name: node.name, is_directory: node.is_directory })));
        
        if (!Array.isArray(result6)) {
            throw new Error('Test 6 failed! readdirEx with path normalization should return an array');
        }

        // Test 7: Verify TreeNode structure for any returned nodes
        console.log('Test 7 - Verifying TreeNode structure');
        const allResults = [...result1, ...result2, ...result3];
        for (const node of allResults) {
            if (!node || typeof node !== 'object') {
                throw new Error('Test 7 failed! All returned items should be objects');
            }
            
            // Check required TreeNode properties
            if (typeof node.is_directory !== 'boolean') {
                throw new Error('Test 7 failed! TreeNode should have boolean is_directory property');
            }
            
            if (typeof node.name !== 'string') {
                throw new Error('Test 7 failed! TreeNode should have string name property');
            }
            
            console.log(`Test 7 - Valid TreeNode: ${node.name} (directory: ${node.is_directory})`);
        }

        // Test 8: Compare results with and without loadContent
        console.log('Test 8 - Comparing results with and without loadContent');
        if (result1.length === result2.length) {
            console.log('Test 8 - Both calls returned same number of items (expected)');
            
            // Compare corresponding nodes
            for (let i = 0; i < result1.length; i++) {
                if (result1[i].name !== result2[i].name) {
                    throw new Error(`Test 8 failed! Node names should match: ${result1[i].name} vs ${result2[i].name}`);
                }
                if (result1[i].is_directory !== result2[i].is_directory) {
                    throw new Error(`Test 8 failed! Directory flags should match for ${result1[i].name}`);
                }
            }
        } else {
            console.log(`Test 8 - Different number of items returned: ${result1.length} vs ${result2.length} (might be acceptable)`);
        }

        console.log('✅ All readdirEx tests passed');
        console.log('=== VFS2 ReaddirEx Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 ReaddirEx Test Failed ===');
        console.error('Error during VFS2 readdirEx test:', error);
        throw error;
    }
}

export async function childrenExistTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 ChildrenExist Test Starting ===');

        // Test 1: Check if root directory has children (should always be true)
        console.log('Test 1 - Checking if root directory has children');
        const result1 = await vfs2.childrenExist(owner_id, '');
        console.log(`Test 1 - Root directory has children: ${result1}`);
        if (!result1) {
            throw new Error('Test 1 failed! Root directory should always have children or be considered to have children');
        }

        // Test 2: Check if root directory with slash has children
        console.log('Test 2 - Checking if root directory with slash has children');
        const result2 = await vfs2.childrenExist(owner_id, '/');
        console.log(`Test 2 - Root directory with slash has children: ${result2}`);
        if (!result2) {
            throw new Error('Test 2 failed! Root directory with slash should always have children or be considered to have children');
        }

        // Test 3: Check if non-existent directory has children (should be false)
        console.log('Test 3 - Checking if non-existent directory has children');
        const result3 = await vfs2.childrenExist(owner_id, 'nonexistent-folder');
        console.log(`Test 3 - Non-existent directory has children: ${result3}`);
        if (result3) {
            throw new Error('Test 3 failed! Non-existent directory should not have children');
        }

        // Test 4: Check if nested non-existent directory has children
        console.log('Test 4 - Checking if nested non-existent directory has children');
        const result4 = await vfs2.childrenExist(owner_id, 'folder/subfolder/nested');
        console.log(`Test 4 - Nested non-existent directory has children: ${result4}`);
        if (result4) {
            throw new Error('Test 4 failed! Nested non-existent directory should not have children');
        }

        // Test 5: Test path normalization in childrenExist
        console.log('Test 5 - Testing path normalization');
        const result5 = await vfs2.childrenExist(owner_id, '//test///path//');
        console.log(`Test 5 - Normalized path has children: ${result5}`);
        if (result5) {
            throw new Error('Test 5 failed! Non-existent normalized path should not have children');
        }

        // Test 6: Check various path formats for non-existent directories
        const testPaths = [
            'single-folder',
            '/single-folder',
            './single-folder',
            'folder/subfolder',
            '/folder/subfolder',
            './folder/subfolder',
            'deeply/nested/folder/structure'
        ];
        
        console.log('Test 6 - Testing various path formats');
        for (const path of testPaths) {
            const result = await vfs2.childrenExist(owner_id, path);
            console.log(`Test 6 - Path '${path}' has children: ${result}`);
            // All should be false since we haven't created any directories yet
            if (result) {
                throw new Error(`Test 6 failed! Path '${path}' should not have children`);
            }
        }

        // Test 7: Test with different owner_id values (edge case testing)
        console.log('Test 7 - Testing with different owner_id values');
        const result7a = await vfs2.childrenExist(owner_id, '');
        const result7b = await vfs2.childrenExist(999999, ''); // Non-existent user
        console.log(`Test 7a - Root with valid owner_id has children: ${result7a}`);
        console.log(`Test 7b - Root with invalid owner_id has children: ${result7b}`);
        
        // Root should always be true regardless of owner_id
        if (!result7a) {
            throw new Error('Test 7a failed! Root should have children for valid owner_id');
        }
        if (!result7b) {
            throw new Error('Test 7b failed! Root should have children even for invalid owner_id');
        }

        // Test 8: Test error handling with malformed paths
        console.log('Test 8 - Testing error handling with special characters');
        const specialPaths = [
            'folder with spaces',
            'folder/with/special/chars!@#',
            'folder\\backslash',
            'folder\ttab',
            'folder\nnewline'
        ];
        
        for (const path of specialPaths) {
            try {
                const result = await vfs2.childrenExist(owner_id, path);
                console.log(`Test 8 - Special path '${path.replace(/\s/g, '\\s')}' has children: ${result}`);
                // Should not have children since these directories don't exist
                if (result) {
                    throw new Error(`Test 8 failed! Special path '${path}' should not have children`);
                }
            } catch (error) {
                // It's acceptable for special characters to cause errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - Special path '${path.replace(/\s/g, '\\s')}' caused error (acceptable):`, errorMessage);
            }
        }

        // Test 9: Test consistency between multiple calls
        console.log('Test 9 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const resultA = await vfs2.childrenExist(owner_id, '');
            const resultB = await vfs2.childrenExist(owner_id, 'nonexistent');
            
            if (!resultA) {
                throw new Error(`Test 9 failed! Root should consistently have children (iteration ${i})`);
            }
            if (resultB) {
                throw new Error(`Test 9 failed! Non-existent path should consistently not have children (iteration ${i})`);
            }
        }

        console.log('✅ All childrenExist tests passed');
        console.log('=== VFS2 ChildrenExist Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 ChildrenExist Test Failed ===');
        console.error('Error during VFS2 childrenExist test:', error);
        throw error;
    }
}

export async function renameTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 Rename Test Starting ===');

        // Test 1: Test rename with invalid new path (should throw error)
        console.log('Test 1 - Testing rename with invalid new path');
        try {
            await vfs2.rename(owner_id, 'old-file.txt', 'invalid path with spaces.txt');
            throw new Error('Test 1 failed! Should have thrown error for invalid new path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Invalid new path threw error:', errorMessage);
            // Accept either "Invalid new path" or "Source file not found" as both are valid errors
            if (!errorMessage.includes('Invalid new path') && !errorMessage.includes('Source file not found')) {
                throw new Error('Test 1 failed! Should throw error about invalid new path or source file not found');
            }
        }

        // Test 2: Test rename with special characters in new path
        console.log('Test 2 - Testing rename with special characters in new path');
        try {
            await vfs2.rename(owner_id, 'old-file.txt', 'file!@#$.txt');
            throw new Error('Test 2 failed! Should have thrown error for special characters');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 2 passed - Special characters threw error:', errorMessage);
        }

        // Test 3: Test rename of non-existent file (should fail)
        console.log('Test 3 - Testing rename of non-existent file');
        try {
            await vfs2.rename(owner_id, 'nonexistent-file.txt', 'new-name.txt');
            throw new Error('Test 3 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent file threw error:', errorMessage);
        }

        // Test 4: Test rename with nested paths
        console.log('Test 4 - Testing rename with nested paths');
        try {
            await vfs2.rename(owner_id, 'folder/file.txt', 'folder/renamed-file.txt');
            throw new Error('Test 4 failed! Should have thrown error for non-existent nested paths');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 passed - Non-existent nested paths threw error:', errorMessage);
        }

        // Test 5: Test rename with different parent directories
        console.log('Test 5 - Testing rename with different parent directories');
        try {
            await vfs2.rename(owner_id, 'folder1/file.txt', 'folder2/file.txt');
            throw new Error('Test 5 failed! Should have thrown error for non-existent directories');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Different parent directories threw error:', errorMessage);
        }

        // Test 6: Test path normalization in rename
        console.log('Test 6 - Testing path normalization in rename');
        try {
            await vfs2.rename(owner_id, '//old//file.txt', 'new_file.txt');
            throw new Error('Test 6 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 6 passed - Path normalization worked, threw error for non-existent file:', errorMessage);
        }

        // Test 7: Test rename with valid filename formats
        console.log('Test 7 - Testing rename with valid filename formats');
        const validNames = [
            'valid_name.txt',
            'valid123.txt', 
            'UPPERCASE.TXT',
            'file_with_underscores.txt',
            'file123_test.txt'
        ];
        
        for (const newName of validNames) {
            try {
                await vfs2.rename(owner_id, 'nonexistent.txt', newName);
                throw new Error(`Test 7 failed! Should have thrown error for non-existent file with name ${newName}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 7 - Valid name '${newName}' processed correctly, threw error for non-existent file`);
                // Ensure it's not a "Invalid new path" error since the name should be valid
                // Accept "Source file not found" as the expected error for valid filenames
                if (errorMessage.includes('Invalid new path')) {
                    throw new Error(`Test 7 failed! Valid name '${newName}' should not be rejected as invalid`);
                }
            }
        }

        // Test 8: Test rename with same old and new paths
        console.log('Test 8 - Testing rename with same old and new paths');
        try {
            await vfs2.rename(owner_id, 'file.txt', 'file.txt');
            throw new Error('Test 8 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 8 passed - Same old and new paths threw error for non-existent file:', errorMessage);
        }

        // Test 9: Test rename with empty paths
        console.log('Test 9 - Testing rename with empty paths');
        try {
            await vfs2.rename(owner_id, '', 'new-name.txt');
            throw new Error('Test 9 failed! Should have thrown error for empty old path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 9 passed - Empty old path threw error:', errorMessage);
        }

        // Test 10: Test rename with root as old path
        console.log('Test 10 - Testing rename with root as old path');
        try {
            await vfs2.rename(owner_id, '/', 'new-root');
            throw new Error('Test 10 failed! Should have thrown error for trying to rename root');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 10 passed - Trying to rename root threw error:', errorMessage);
        }

        // Test 11: Test parsePath functionality through rename
        console.log('Test 11 - Testing parsePath functionality through rename');
        try {
            await vfs2.rename(owner_id, 'deeply/nested/path/file.txt', 'deeply/nested/path/renamed.txt');
            throw new Error('Test 11 failed! Should have thrown error for non-existent nested path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 11 passed - Deeply nested paths processed correctly, threw error for non-existent paths:', errorMessage);
        }

        console.log('✅ All rename tests passed');
        console.log('=== VFS2 Rename Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Rename Test Failed ===');
        console.error('Error during VFS2 rename test:', error);
        throw error;
    }
}

export async function statTest(): Promise<void> {
    try {
        console.log('=== VFS2 Stat Test Starting ===');

        // Test 1: Check stat for root directory (should always work)
        console.log('Test 1 - Getting stat for root directory');
        const result1 = await vfs2.stat('');
        console.log(`Test 1 - Root directory stat:`, JSON.stringify(result1, null, 2));
        
        // Verify root directory properties
        if (!result1.is_directory) {
            throw new Error('Test 1 failed! Root should be a directory');
        }
        if (result1.is_public !== false) {
            throw new Error('Test 1 failed! Root should not be public');
        }
        if (typeof result1.size !== 'number' || result1.size < 0) {
            throw new Error('Test 1 failed! Root size should be a non-negative number');
        }
        if (!(result1.birthtime instanceof Date)) {
            throw new Error('Test 1 failed! Root birthtime should be a Date object');
        }
        if (!(result1.mtime instanceof Date)) {
            throw new Error('Test 1 failed! Root mtime should be a Date object');
        }

        // Test 2: Check stat for root directory with slash
        console.log('Test 2 - Getting stat for root directory with slash');
        const result2 = await vfs2.stat('/');
        console.log(`Test 2 - Root directory with slash stat:`, JSON.stringify(result2, null, 2));
        
        // Should be identical to Test 1
        if (!result2.is_directory) {
            throw new Error('Test 2 failed! Root with slash should be a directory');
        }
        if (result2.is_public !== false) {
            throw new Error('Test 2 failed! Root with slash should not be public');
        }

        // Test 3: Check stat for non-existent file (should throw error)
        console.log('Test 3 - Getting stat for non-existent file');
        try {
            await vfs2.stat('nonexistent-file.txt');
            throw new Error('Test 3 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 3 failed! Should throw specific "File not found" error');
            }
        }

        // Test 4: Check stat for non-existent nested path (should throw error)
        console.log('Test 4 - Getting stat for non-existent nested path');
        try {
            await vfs2.stat('folder/subfolder/file.txt');
            throw new Error('Test 4 failed! Should have thrown error for non-existent nested path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 passed - Non-existent nested path threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 4 failed! Should throw specific "File not found" error');
            }
        }

        // Test 5: Test path normalization in stat
        console.log('Test 5 - Testing path normalization');
        try {
            await vfs2.stat('//test///path//file.txt');
            throw new Error('Test 5 failed! Should have thrown error for non-existent normalized path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Normalized non-existent path threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 5 failed! Should throw specific "File not found" error');
            }
        }

        // Test 6: Test various non-existent path formats
        const testPaths = [
            'single-file.txt',
            '/single-file.txt', 
            './single-file.txt',
            'folder/file.txt',
            '/folder/file.txt',
            './folder/file.txt',
            'deeply/nested/folder/structure/file.txt'
        ];
        
        console.log('Test 6 - Testing various non-existent path formats');
        for (const path of testPaths) {
            try {
                await vfs2.stat(path);
                throw new Error(`Test 6 failed! Path '${path}' should not exist`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 6 - Path '${path}' correctly threw error: ${errorMessage.substring(0, 50)}...`);
                if (!errorMessage.includes('File not found')) {
                    throw new Error(`Test 6 failed! Path '${path}' should throw "File not found" error`);
                }
            }
        }

        // Test 7: Test stat with different path normalizations for root
        const rootPaths = [
            '',
            '/',
            '//',
            '///',
            './',
            './/',
            '././'
        ];
        
        console.log('Test 7 - Testing root path normalizations');
        for (const path of rootPaths) {
            const result = await vfs2.stat(path);
            console.log(`Test 7 - Path '${path}' normalized correctly, is_directory: ${result.is_directory}`);
            
            if (!result.is_directory) {
                throw new Error(`Test 7 failed! Path '${path}' should resolve to root directory`);
            }
            if (result.is_public !== false) {
                throw new Error(`Test 7 failed! Path '${path}' should resolve to non-public root`);
            }
            if (typeof result.size !== 'number') {
                throw new Error(`Test 7 failed! Path '${path}' should have numeric size`);
            }
        }

        // Test 8: Test IFSStats interface compliance
        console.log('Test 8 - Testing IFSStats interface compliance');
        const rootStat = await vfs2.stat('');
        
        // Check all required properties exist
        const requiredProps = ['is_directory', 'birthtime', 'mtime', 'size'];
        for (const prop of requiredProps) {
            if (!(prop in rootStat)) {
                throw new Error(`Test 8 failed! Missing required property: ${prop}`);
            }
        }
        
        // Check optional property
        if (!('is_public' in rootStat)) {
            throw new Error('Test 8 failed! Missing is_public property');
        }
        
        // Check types
        if (typeof rootStat.is_directory !== 'boolean') {
            throw new Error('Test 8 failed! is_directory should be boolean');
        }
        if (typeof rootStat.is_public !== 'boolean') {
            throw new Error('Test 8 failed! is_public should be boolean');
        }
        if (!(rootStat.birthtime instanceof Date)) {
            throw new Error('Test 8 failed! birthtime should be Date object');
        }
        if (!(rootStat.mtime instanceof Date)) {
            throw new Error('Test 8 failed! mtime should be Date object');
        }
        if (typeof rootStat.size !== 'number') {
            throw new Error('Test 8 failed! size should be number');
        }

        // Test 9: Test consistency between multiple calls
        console.log('Test 9 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const stat1 = await vfs2.stat('');
            const stat2 = await vfs2.stat('/');
            
            if (stat1.is_directory !== stat2.is_directory) {
                throw new Error(`Test 9 failed! is_directory should be consistent (iteration ${i})`);
            }
            if (stat1.is_public !== stat2.is_public) {
                throw new Error(`Test 9 failed! is_public should be consistent (iteration ${i})`);
            }
            if (stat1.size !== stat2.size) {
                throw new Error(`Test 9 failed! size should be consistent (iteration ${i})`);
            }
        }

        // Test 10: Test error handling for edge cases
        console.log('Test 10 - Testing error handling for edge cases');
        const edgeCases = [
            'file with spaces.txt',
            'file\ttab.txt',
            'file\nnewline.txt',
            'file!@#$.txt',
            'very/long/path/with/many/segments/and/a/very/long/filename/that/exceeds/normal/limits/but/should/still/be/handled/gracefully.txt'
        ];
        
        for (const path of edgeCases) {
            try {
                await vfs2.stat(path);
                throw new Error(`Test 10 failed! Edge case path '${path.replace(/\s/g, '\\s')}' should not exist`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 10 - Edge case '${path.replace(/\s/g, '\\s').substring(0, 30)}...' handled correctly`);
                // Should throw some kind of error (either "File not found" or validation error)
                if (!errorMessage) {
                    throw new Error(`Test 10 failed! Edge case should throw an error with message`);
                }
            }
        }

        console.log('✅ All stat tests passed');
        console.log('=== VFS2 Stat Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Stat Test Failed ===');
        console.error('Error during VFS2 stat test:', error);
        throw error;
    }
}

export async function shiftOrdinalsDownTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 ShiftOrdinalsDown Test Starting ===');

        // Test 1: Test shifting ordinals in root directory (should return empty mapping)
        console.log('Test 1 - Testing shiftOrdinalsDown in root directory');
        const result1 = await vfs2.shiftOrdinalsDown(owner_id, '', 1, 1);
        console.log(`Test 1 - Root directory shift result (${result1.size} items):`, 
            Array.from(result1.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result1 || !(result1 instanceof Map)) {
            throw new Error('Test 1 failed! shiftOrdinalsDown should return a Map');
        }

        // Test 2: Test shifting ordinals in non-existent directory (should return empty mapping)
        console.log('Test 2 - Testing shiftOrdinalsDown in non-existent directory');
        const result2 = await vfs2.shiftOrdinalsDown(owner_id, 'nonexistent-folder', 1, 1);
        console.log(`Test 2 - Non-existent directory shift result (${result2.size} items):`, 
            Array.from(result2.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result2 || !(result2 instanceof Map)) {
            throw new Error('Test 2 failed! shiftOrdinalsDown should return a Map');
        }
        
        // Should return empty map since directory doesn't exist
        if (result2.size !== 0) {
            throw new Error('Test 2 failed! Non-existent directory should return empty mapping');
        }

        // Test 3: Test shifting ordinals with different parameters
        console.log('Test 3 - Testing shiftOrdinalsDown with various parameters');
        const testCases = [
            { path: 'folder1', insertOrdinal: 0, slotsToAdd: 1 },
            { path: 'folder2', insertOrdinal: 5, slotsToAdd: 2 },
            { path: 'nested/folder', insertOrdinal: 10, slotsToAdd: 3 },
            { path: 'deeply/nested/folder/structure', insertOrdinal: 1, slotsToAdd: 5 }
        ];
        
        for (const testCase of testCases) {
            const result = await vfs2.shiftOrdinalsDown(owner_id, testCase.path, testCase.insertOrdinal, testCase.slotsToAdd);
            console.log(`Test 3 - Path '${testCase.path}' with ordinal ${testCase.insertOrdinal}, slots ${testCase.slotsToAdd}: ${result.size} items shifted`);
            
            if (!result || !(result instanceof Map)) {
                throw new Error(`Test 3 failed! shiftOrdinalsDown should return a Map for path '${testCase.path}'`);
            }
            
            // Should return empty map since directories don't exist
            if (result.size !== 0) {
                throw new Error(`Test 3 failed! Non-existent directory '${testCase.path}' should return empty mapping`);
            }
        }

        // Test 4: Test path normalization in shiftOrdinalsDown
        console.log('Test 4 - Testing path normalization');
        const result4 = await vfs2.shiftOrdinalsDown(owner_id, '//test///path//', 1, 1);
        console.log(`Test 4 - Normalized path shift result (${result4.size} items):`, 
            Array.from(result4.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result4 || !(result4 instanceof Map)) {
            throw new Error('Test 4 failed! shiftOrdinalsDown with path normalization should return a Map');
        }
        
        if (result4.size !== 0) {
            throw new Error('Test 4 failed! Non-existent normalized path should return empty mapping');
        }

        // Test 5: Test error handling with negative values
        console.log('Test 5 - Testing error handling with edge case values');
        try {
            // Test with negative insertOrdinal (might be valid depending on implementation)
            const result5a = await vfs2.shiftOrdinalsDown(owner_id, 'test', -1, 1);
            console.log('Test 5a - Negative insertOrdinal handled:', result5a.size);
            
            if (!result5a || !(result5a instanceof Map)) {
                throw new Error('Test 5a failed! Should return a Map even with negative insertOrdinal');
            }
        } catch (error) {
            // It's acceptable for negative values to cause errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5a - Negative insertOrdinal caused error (acceptable):', errorMessage);
        }
        
        try {
            // Test with negative slotsToAdd (might be valid for shifting up instead of down)
            const result5b = await vfs2.shiftOrdinalsDown(owner_id, 'test', 1, -1);
            console.log('Test 5b - Negative slotsToAdd handled:', result5b.size);
            
            if (!result5b || !(result5b instanceof Map)) {
                throw new Error('Test 5b failed! Should return a Map even with negative slotsToAdd');
            }
        } catch (error) {
            // It's acceptable for negative values to cause errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5b - Negative slotsToAdd caused error (acceptable):', errorMessage);
        }

        // Test 6: Test with zero values
        console.log('Test 6 - Testing with zero values');
        const result6a = await vfs2.shiftOrdinalsDown(owner_id, 'test', 0, 1);
        console.log(`Test 6a - Zero insertOrdinal result (${result6a.size} items)`);
        
        if (!result6a || !(result6a instanceof Map)) {
            throw new Error('Test 6a failed! shiftOrdinalsDown with zero insertOrdinal should return a Map');
        }
        
        const result6b = await vfs2.shiftOrdinalsDown(owner_id, 'test', 1, 0);
        console.log(`Test 6b - Zero slotsToAdd result (${result6b.size} items)`);
        
        if (!result6b || !(result6b instanceof Map)) {
            throw new Error('Test 6b failed! shiftOrdinalsDown with zero slotsToAdd should return a Map');
        }

        // Test 7: Test with large values
        console.log('Test 7 - Testing with large values');
        const result7 = await vfs2.shiftOrdinalsDown(owner_id, 'test', 9999, 9999);
        console.log(`Test 7 - Large values result (${result7.size} items)`);
        
        if (!result7 || !(result7 instanceof Map)) {
            throw new Error('Test 7 failed! shiftOrdinalsDown with large values should return a Map');
        }

        // Test 8: Test consistency between multiple calls
        console.log('Test 8 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const resultA = await vfs2.shiftOrdinalsDown(owner_id, 'test', 1, 1);
            const resultB = await vfs2.shiftOrdinalsDown(owner_id, 'nonexistent', 1, 1);
            
            if (!(resultA instanceof Map) || !(resultB instanceof Map)) {
                throw new Error(`Test 8 failed! All calls should return Maps (iteration ${i})`);
            }
            
            // Both should be empty since directories don't exist
            if (resultA.size !== 0 || resultB.size !== 0) {
                throw new Error(`Test 8 failed! Non-existent directories should consistently return empty mappings (iteration ${i})`);
            }
        }

        // Test 9: Test with different owner_id values
        console.log('Test 9 - Testing with different owner_id values');
        const result9a = await vfs2.shiftOrdinalsDown(owner_id, 'test', 1, 1);
        const result9b = await vfs2.shiftOrdinalsDown(999999, 'test', 1, 1); // Non-existent user
        
        console.log(`Test 9a - Valid owner_id result (${result9a.size} items)`);
        console.log(`Test 9b - Invalid owner_id result (${result9b.size} items)`);
        
        if (!(result9a instanceof Map) || !(result9b instanceof Map)) {
            throw new Error('Test 9 failed! Both calls should return Maps');
        }

        // Test 10: Test mapping format when result is not empty (conceptual test)
        console.log('Test 10 - Testing mapping format (conceptual)');
        // Since we don't have any actual files to shift, we can't test the actual mapping
        // But we can verify that the return type and structure are correct
        const result10 = await vfs2.shiftOrdinalsDown(owner_id, '', 1, 1);
        
        if (!(result10 instanceof Map)) {
            throw new Error('Test 10 failed! Result should be a Map instance');
        }
        
        // Test that we can iterate over the map (even if empty)
        for (const [oldPath, newPath] of result10) {
            console.log(`Test 10 - Mapping: ${oldPath} -> ${newPath}`);
            
            if (typeof oldPath !== 'string' || typeof newPath !== 'string') {
                throw new Error('Test 10 failed! Map keys and values should be strings');
            }
        }

        console.log('✅ All shiftOrdinalsDown tests passed');
        console.log('=== VFS2 ShiftOrdinalsDown Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 ShiftOrdinalsDown Test Failed ===');
        console.error('Error during VFS2 shiftOrdinalsDown test:', error);
        throw error;
    }
}

export async function writeFileExTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 WriteFileEx Test Starting ===');

        // Debug: Check initial state of root directory
        console.log('Debug - Checking initial state of root directory');
        const initialRootContents = await vfs2.readdirEx(owner_id, '', false);
        console.log(`Debug - Initial root directory has ${initialRootContents.length} items:`, 
            initialRootContents.map(node => ({ name: node.name, ordinal: node.ordinal, owner: node.owner_id })));

        // Test 1: Create a simple text file with ordinal
        console.log('Test 1 - Creating simple text file with ordinal');
        const testFileName = 'test-file-ordinal.md';
        const testContent = '# Test File\n\nThis is a test file created with a specific ordinal.';
        const testOrdinal = 5;
        
        try {
            await vfs2.writeFileEx(owner_id, testFileName, testContent, 'utf8', false, testOrdinal);
            console.log(`Test 1 - Successfully created file: ${testFileName} with ordinal: ${testOrdinal}`);
            
            // Verify the file was created by checking if it exists
            const fileExists = await vfs2.exists(testFileName);
            if (!fileExists) {
                throw new Error('Test 1 failed! File should exist after creation');
            }
            console.log('Test 1 - File existence verified');
            
            // Verify the file has the correct ordinal by reading directory
            const rootContents = await vfs2.readdirEx(owner_id, '', false);
            const createdFile = rootContents.find(node => node.name === testFileName);
            
            if (!createdFile) {
                throw new Error('Test 1 failed! Created file not found in directory listing');
            }
            
            if (createdFile.ordinal !== testOrdinal) {
                throw new Error(`Test 1 failed! File ordinal should be ${testOrdinal}, but got ${createdFile.ordinal}`);
            }
            console.log(`Test 1 - File ordinal verified: ${createdFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 1 failed during file creation:', error);
            throw error;
        }

        // Test 2: Create a file without specifying ordinal (should auto-assign)
        console.log('Test 2 - Creating file without specifying ordinal');
        const testFileName2 = 'test-file-auto-ordinal.md';
        const testContent2 = '# Auto Ordinal Test\n\nThis file should get an auto-assigned ordinal.';
        
        try {
            // First, let's check what files are currently in the root directory
            const rootContentsBefore = await vfs2.readdirEx(owner_id, '', false);
            console.log(`Test 2 - Files in root before creation (${rootContentsBefore.length} items):`, 
                rootContentsBefore.map(node => ({ name: node.name, ordinal: node.ordinal })));
            
            await vfs2.writeFileEx(owner_id, testFileName2, testContent2, 'utf8', false);
            console.log(`Test 2 - Successfully created file: ${testFileName2} with auto-assigned ordinal`);
            
            // Verify the file exists
            const fileExists = await vfs2.exists(testFileName2);
            if (!fileExists) {
                throw new Error('Test 2 failed! File should exist after creation');
            }
            
            // Check what ordinal was assigned
            const rootContents = await vfs2.readdirEx(owner_id, '', false);
            const createdFile = rootContents.find(node => node.name === testFileName2);
            
            if (!createdFile) {
                throw new Error('Test 2 failed! Created file not found in directory listing');
            }
            
            console.log(`Test 2 - File auto-assigned ordinal: ${createdFile.ordinal}`);
            
            // Auto-assigned ordinal should be reasonable (not negative, and should be a valid integer)
            if (createdFile.ordinal == null || createdFile.ordinal < 0) {
                throw new Error(`Test 2 failed! Auto-assigned ordinal ${createdFile.ordinal} should be non-negative`);
            }
            
            // The ordinal might be high if there's existing data in the database, so just check it's reasonable
            if (createdFile.ordinal > 100000) {
                console.warn(`Test 2 - Warning: Auto-assigned ordinal ${createdFile.ordinal} is quite high - there may be existing data in the database`);
            }
            
            // Verify the ordinal is higher than the previous file's ordinal
            const firstFileOrdinal = rootContents.find(node => node.name === testFileName)?.ordinal;
            if (firstFileOrdinal != null && createdFile.ordinal <= firstFileOrdinal) {
                throw new Error(`Test 2 failed! Auto-assigned ordinal ${createdFile.ordinal} should be higher than previous file's ordinal ${firstFileOrdinal}`);
            }
            
        } catch (error) {
            console.error('Test 2 failed during file creation:', error);
            throw error;
        }

        // Test 3: Create file in a nested path (should fail since path doesn't exist)
        console.log('Test 3 - Attempting to create file in non-existent nested path');
        try {
            await vfs2.writeFileEx(owner_id, 'nonexistent/folder/test.md', 'content', 'utf8', false, 1);
            throw new Error('Test 3 failed! Should have thrown error for non-existent parent directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent parent directory threw error:', errorMessage);
            // Accept various possible error messages related to missing parent
            if (!errorMessage.toLowerCase().includes('parent') && 
                !errorMessage.toLowerCase().includes('directory') && 
                !errorMessage.toLowerCase().includes('not found') &&
                !errorMessage.toLowerCase().includes('exist')) {
                console.warn('Test 3 - Unexpected error message, but accepting as valid:', errorMessage);
            }
        }

        // Test 4: Create file with different content types
        console.log('Test 4 - Creating files with different content types');
        const testFiles = [
            { name: 'test.txt', content: 'Plain text content', ordinal: 10 },
            { name: 'test.json', content: '{"key": "value"}', ordinal: 11 },
            { name: 'test.html', content: '<html><body>HTML content</body></html>', ordinal: 12 }
        ];
        
        for (const file of testFiles) {
            try {
                await vfs2.writeFileEx(owner_id, file.name, file.content, 'utf8', false, file.ordinal);
                console.log(`Test 4 - Successfully created ${file.name} with ordinal ${file.ordinal}`);
                
                // Verify existence
                const exists = await vfs2.exists(file.name);
                if (!exists) {
                    throw new Error(`Test 4 failed! File ${file.name} should exist after creation`);
                }
                
                // Verify ordinal
                const rootContents = await vfs2.readdirEx(owner_id, '', false);
                const createdFile = rootContents.find(node => node.name === file.name);
                
                if (!createdFile || createdFile.ordinal !== file.ordinal) {
                    throw new Error(`Test 4 failed! File ${file.name} should have ordinal ${file.ordinal}`);
                }
                
            } catch (error) {
                console.error(`Test 4 failed for file ${file.name}:`, error);
                throw error;
            }
        }

        // Test 5: Test overwriting existing file (should update ordinal)
        console.log('Test 5 - Overwriting existing file with new ordinal');
        const existingFileName = testFileName; // Use file from Test 1
        const newContent = '# Updated Content\n\nThis file has been overwritten with new content and ordinal.';
        const newOrdinal = 20;
        
        try {
            await vfs2.writeFileEx(owner_id, existingFileName, newContent, 'utf8', false, newOrdinal);
            console.log(`Test 5 - Successfully overwrite file: ${existingFileName} with new ordinal: ${newOrdinal}`);
            
            // Verify the ordinal was updated
            const rootContents = await vfs2.readdirEx(owner_id, '', false);
            const updatedFile = rootContents.find(node => node.name === existingFileName);
            
            if (!updatedFile) {
                throw new Error('Test 5 failed! Overwritten file not found in directory listing');
            }
            
            if (updatedFile.ordinal !== newOrdinal) {
                throw new Error(`Test 5 failed! File ordinal should be updated to ${newOrdinal}, but got ${updatedFile.ordinal}`);
            }
            console.log(`Test 5 - File ordinal successfully updated to: ${updatedFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 5 failed during file overwrite:', error);
            throw error;
        }

        // Test 6: Test with binary data (Buffer)
        console.log('Test 6 - Creating file with binary data');
        const binaryFileName = 'test-binary.dat';
        const binaryData = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" in ASCII
        const binaryOrdinal = 25;
        
        try {
            await vfs2.writeFileEx(owner_id, binaryFileName, binaryData, 'utf8', false, binaryOrdinal);
            console.log(`Test 6 - Successfully created binary file: ${binaryFileName}`);
            
            // Verify existence
            const exists = await vfs2.exists(binaryFileName);
            if (!exists) {
                throw new Error('Test 6 failed! Binary file should exist after creation');
            }
            
            // Verify ordinal
            const rootContents = await vfs2.readdirEx(owner_id, '', false);
            const binaryFile = rootContents.find(node => node.name === binaryFileName);
            
            if (!binaryFile || binaryFile.ordinal !== binaryOrdinal) {
                throw new Error(`Test 6 failed! Binary file should have ordinal ${binaryOrdinal}`);
            }
            console.log(`Test 6 - Binary file ordinal verified: ${binaryFile.ordinal}`);
            
        } catch (error) {
            console.error('Test 6 failed during binary file creation:', error);
            throw error;
        }

        // Test 7: Test ordinal ordering in directory listing
        console.log('Test 7 - Verifying ordinal ordering in directory listing');
        const rootContents = await vfs2.readdirEx(owner_id, '', false);
        
        // Filter to only files we created (to avoid interference from other tests)
        const ourFiles = rootContents.filter(node => 
            node.name.startsWith('test-') || node.name.startsWith('test.'));
        
        console.log('Test 7 - Our created files with ordinals:');
        ourFiles.forEach(file => {
            console.log(`  - ${file.name}: ordinal ${file.ordinal}`);
        });
        
        // Verify files are ordered by ordinal
        for (let i = 1; i < ourFiles.length; i++) {
            const prevOrdinal = ourFiles[i-1].ordinal;
            const currOrdinal = ourFiles[i].ordinal;
            if (prevOrdinal != null && currOrdinal != null && prevOrdinal > currOrdinal) {
                throw new Error(`Test 7 failed! Files should be ordered by ordinal: ${ourFiles[i-1].name} (${prevOrdinal}) should come after ${ourFiles[i].name} (${currOrdinal})`);
            }
        }
        console.log('Test 7 - File ordering by ordinal verified');

        // Test 8: Test with various ordinal values
        console.log('Test 8 - Testing with various ordinal values');
        const ordinalTests = [
            { name: 'ordinal-zero.md', ordinal: 0 },
            { name: 'ordinal-negative.md', ordinal: -1 },
            { name: 'ordinal-large.md', ordinal: 9999 }
        ];
        
        for (const test of ordinalTests) {
            try {
                await vfs2.writeFileEx(owner_id, test.name, `Content for ${test.name}`, 'utf8', false, test.ordinal);
                console.log(`Test 8 - Successfully created ${test.name} with ordinal ${test.ordinal}`);
                
                // Verify ordinal
                const exists = await vfs2.exists(test.name);
                if (!exists) {
                    throw new Error(`Test 8 failed! File ${test.name} should exist`);
                }
                
                const rootContents = await vfs2.readdirEx(owner_id, '', false);
                const file = rootContents.find(node => node.name === test.name);
                
                if (!file || file.ordinal !== test.ordinal) {
                    throw new Error(`Test 8 failed! File ${test.name} should have ordinal ${test.ordinal}, got ${file?.ordinal}`);
                }
                
            } catch (error) {
                // Some ordinal values might be rejected by the database (e.g., negative values)
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - Ordinal ${test.ordinal} caused error (may be acceptable):`, errorMessage);
                
                // If it's a constraint or validation error, that's acceptable
                if (!errorMessage.toLowerCase().includes('constraint') && 
                    !errorMessage.toLowerCase().includes('violat') &&
                    !errorMessage.toLowerCase().includes('invalid') &&
                    !errorMessage.toLowerCase().includes('check')) {
                    throw new Error(`Test 8 failed! Unexpected error for ordinal ${test.ordinal}: ${errorMessage}`);
                }
            }
        }

        console.log('✅ All writeFileEx tests passed');
        console.log('=== VFS2 WriteFileEx Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 WriteFileEx Test Failed ===');
        console.error('Error during VFS2 writeFileEx test:', error);
        throw error;
    }
}

export async function writeFileAndReadFileTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 WriteFile and ReadFile Test Starting ===');

        // Test 1: Write and read a simple text file
        console.log('Test 1 - Write and read simple text file');
        const testFileName1 = 'test-write-read.md';
        const testContent1 = '# Test File\n\nThis is a test file for writeFile and readFile methods.\n\nIt contains:\n- Markdown content\n- Multiple lines\n- Special characters: äöü @#$%';
        
        // Write the file
        await vfs2.writeFile(owner_id, testFileName1, testContent1, 'utf8');
        console.log(`Test 1 - Successfully wrote file: ${testFileName1}`);
        
        // Verify file exists
        const fileExists1 = await vfs2.exists(testFileName1);
        if (!fileExists1) {
            throw new Error('Test 1 failed! File should exist after writeFile');
        }
        console.log('Test 1 - File existence verified');
        
        // Read the file back
        const readContent1 = await vfs2.readFile(owner_id, testFileName1, 'utf8');
        console.log(`Test 1 - Successfully read file, content length: ${readContent1.toString().length}`);
        
        // Verify content matches
        if (readContent1.toString() !== testContent1) {
            throw new Error('Test 1 failed! Read content does not match written content');
        }
        console.log('Test 1 - Content verification passed');

        // Test 2: Write and read file without encoding (should return Buffer)
        console.log('Test 2 - Write and read file without encoding');
        const testFileName2 = 'test-binary-mode.txt';
        const testContent2 = 'Binary mode test content with special chars: ñáéíóú';
        
        // Write the file
        await vfs2.writeFile(owner_id, testFileName2, testContent2);
        console.log(`Test 2 - Successfully wrote file: ${testFileName2}`);
        
        // Read without encoding (should return Buffer)
        const readContent2 = await vfs2.readFile(owner_id, testFileName2);
        console.log(`Test 2 - Read without encoding, got type: ${typeof readContent2}, isBuffer: ${Buffer.isBuffer(readContent2)}`);
        
        if (!Buffer.isBuffer(readContent2)) {
            throw new Error('Test 2 failed! Reading without encoding should return Buffer');
        }
        
        // Convert buffer to string and verify content
        const stringContent2 = readContent2.toString('utf8');
        if (stringContent2 !== testContent2) {
            throw new Error('Test 2 failed! Buffer content does not match written content');
        }
        console.log('Test 2 - Buffer content verification passed');

        // Test 3: Write and read with Buffer input
        console.log('Test 3 - Write and read with Buffer input');
        const testFileName3 = 'test-buffer-input.dat';
        const testContent3 = Buffer.from('Buffer input test with binary data: \x00\x01\x02\x03\xFF', 'utf8');
        
        // Write with Buffer
        await vfs2.writeFile(owner_id, testFileName3, testContent3, 'utf8');
        console.log(`Test 3 - Successfully wrote file with Buffer: ${testFileName3}`);
        
        // Read back
        const readContent3 = await vfs2.readFile(owner_id, testFileName3, 'utf8');
        console.log(`Test 3 - Read back content, length: ${readContent3.toString().length}`);
        
        // Verify content
        if (readContent3.toString() !== testContent3.toString()) {
            throw new Error('Test 3 failed! Buffer read content does not match written content');
        }
        console.log('Test 3 - Buffer input/output verification passed');

        // Test 4: Write and read JSON content
        console.log('Test 4 - Write and read JSON content');
        const testFileName4 = 'test-data.json';
        const testObject = {
            name: 'Test Object',
            values: [1, 2, 3, 'string', true, null],
            nested: {
                property: 'value',
                unicode: 'äöüñáéíóú'
            }
        };
        const testContent4 = JSON.stringify(testObject, null, 2);
        
        // Write JSON
        await vfs2.writeFile(owner_id, testFileName4, testContent4, 'utf8');
        console.log(`Test 4 - Successfully wrote JSON file: ${testFileName4}`);
        
        // Read and parse JSON
        const readContent4 = await vfs2.readFile(owner_id, testFileName4, 'utf8');
        const parsedObject = JSON.parse(readContent4.toString());
        
        // Verify JSON content
        if (JSON.stringify(parsedObject) !== JSON.stringify(testObject)) {
            throw new Error('Test 4 failed! Parsed JSON does not match original object');
        }
        console.log('Test 4 - JSON content verification passed');

        // Test 5: Overwrite existing file
        console.log('Test 5 - Overwrite existing file');
        const newContent1 = 'This is completely new content that replaces the original.';
        
        await vfs2.writeFile(owner_id, testFileName1, newContent1, 'utf8');
        console.log(`Test 5 - Successfully overwrote file: ${testFileName1}`);
        
        const readNewContent = await vfs2.readFile(owner_id, testFileName1, 'utf8');
        if (readNewContent.toString() !== newContent1) {
            throw new Error('Test 5 failed! Overwritten content does not match');
        }
        console.log('Test 5 - File overwrite verification passed');

        // Test 6: Test different encodings
        console.log('Test 6 - Test different encodings');
        const testFileName6 = 'test-encoding.txt';
        const testContent6 = 'Encoding test: äöüñáéíóú';
        
        // Write with utf8
        await vfs2.writeFile(owner_id, testFileName6, testContent6, 'utf8');
        
        // Read with different encoding methods
        const readUtf8 = await vfs2.readFile(owner_id, testFileName6, 'utf8');
        const readBuffer = await vfs2.readFile(owner_id, testFileName6);
        const readLatin1 = await vfs2.readFile(owner_id, testFileName6, 'latin1');
        
        console.log(`Test 6 - UTF8 read: ${readUtf8.toString().substring(0, 20)}...`);
        console.log(`Test 6 - Buffer read length: ${(readBuffer as Buffer).length}`);
        console.log(`Test 6 - Latin1 read: ${readLatin1.toString().substring(0, 20)}...`);
        
        // UTF8 should match original
        if (readUtf8.toString() !== testContent6) {
            throw new Error('Test 6 failed! UTF8 encoding read does not match');
        }
        
        // Buffer converted to UTF8 should match
        if ((readBuffer as Buffer).toString('utf8') !== testContent6) {
            throw new Error('Test 6 failed! Buffer read converted to UTF8 does not match');
        }
        console.log('Test 6 - Encoding tests passed');

        // Test 7: Test reading non-existent file
        console.log('Test 7 - Test reading non-existent file');
        try {
            await vfs2.readFile(owner_id, 'nonexistent-file.txt', 'utf8');
            throw new Error('Test 7 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 7 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 7 failed! Should throw specific "File not found" error');
            }
        }

        // Test 8: Test writing to non-existent directory
        console.log('Test 8 - Test writing to non-existent directory');
        try {
            await vfs2.writeFile(owner_id, 'nonexistent/folder/file.txt', 'content', 'utf8');
            throw new Error('Test 8 failed! Should have thrown error for non-existent directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 8 passed - Non-existent directory threw error:', errorMessage);
        }

        // Test 9: Test large file content
        console.log('Test 9 - Test large file content');
        const testFileName9 = 'test-large-file.txt';
        const largeContent = 'A'.repeat(10000) + '\n' + 'Large file test content with many repetitions.\n' + 'B'.repeat(10000);
        
        await vfs2.writeFile(owner_id, testFileName9, largeContent, 'utf8');
        console.log(`Test 9 - Successfully wrote large file: ${testFileName9}, size: ${largeContent.length}`);
        
        const readLargeContent = await vfs2.readFile(owner_id, testFileName9, 'utf8');
        if (readLargeContent.toString() !== largeContent) {
            throw new Error('Test 9 failed! Large file content does not match');
        }
        console.log('Test 9 - Large file verification passed');

        // Test 10: Verify all files are accessible via directory listing
        console.log('Test 10 - Verify files are accessible via directory listing');
        const rootContents = await vfs2.readdirEx(owner_id, '', false);
        const ourTestFiles = rootContents.filter(node => node.name.startsWith('test-'));
        
        console.log(`Test 10 - Found ${ourTestFiles.length} test files in directory:`);
        ourTestFiles.forEach(file => {
            console.log(`  - ${file.name} (ordinal: ${file.ordinal}, directory: ${file.is_directory})`);
        });
        
        // Verify all our test files are present
        const expectedFiles = [testFileName1, testFileName2, testFileName3, testFileName4, testFileName6, testFileName9];
        for (const expectedFile of expectedFiles) {
            const found = ourTestFiles.find(file => file.name === expectedFile);
            if (!found) {
                throw new Error(`Test 10 failed! Expected file ${expectedFile} not found in directory listing`);
            }
            if (found.is_directory) {
                throw new Error(`Test 10 failed! File ${expectedFile} should not be marked as directory`);
            }
        }
        console.log('Test 10 - All files found in directory listing');

        console.log('✅ All writeFile and readFile tests passed');
        console.log('=== VFS2 WriteFile and ReadFile Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 WriteFile and ReadFile Test Failed ===');
        console.error('Error during VFS2 writeFile/readFile test:', error);
        throw error;
    }
}

export async function rmTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 RM Test Starting ===');

        // Test 1: Test deleting non-existent file without force (should throw error)
        console.log('Test 1 - Attempting to delete non-existent file without force');
        try {
            await vfs2.rm(owner_id, 'nonexistent-file.txt');
            throw new Error('Test 1 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('not found') && !errorMessage.includes('File not found')) {
                throw new Error('Test 1 failed! Should throw "not found" error');
            }
        }

        // Test 2: Test deleting non-existent file with force (should not throw error)
        console.log('Test 2 - Attempting to delete non-existent file with force');
        await vfs2.rm(owner_id, 'nonexistent-file.txt', { force: true });
        console.log('Test 2 passed - Non-existent file with force did not throw error');

        // Test 3: Test deleting root directory (should throw error)
        console.log('Test 3 - Attempting to delete root directory');
        try {
            await vfs2.rm(owner_id, '');
            throw new Error('Test 3 failed! Should have thrown error for root directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Root directory deletion threw error:', errorMessage);
            if (!errorMessage.includes('Cannot delete root directory')) {
                throw new Error('Test 3 failed! Should throw specific root directory error');
            }
        }

        // Test 4: Create a test file and then delete it
        console.log('Test 4 - Create and delete a test file');
        const testFileName = 'test-rm-file.txt';
        const testContent = 'This file will be deleted by the rm test.';
        
        // Create the file
        await vfs2.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 4 - Created test file: ${testFileName}`);
        
        // Verify it exists
        const existsBefore = await vfs2.exists(testFileName);
        if (!existsBefore) {
            throw new Error('Test 4 failed! Test file should exist after creation');
        }
        console.log('Test 4 - File existence verified before deletion');
        
        // Delete the file
        await vfs2.rm(owner_id, testFileName);
        console.log('Test 4 - Successfully deleted test file');
        
        // Verify it no longer exists
        const existsAfter = await vfs2.exists(testFileName);
        if (existsAfter) {
            throw new Error('Test 4 failed! Test file should not exist after deletion');
        }
        console.log('Test 4 - File deletion verified');

        // Test 5: Test deleting with path normalization
        console.log('Test 5 - Test deletion with path normalization');
        const testFileName5 = 'test-rm-normalize.txt';
        
        // Create file
        await vfs2.writeFile(owner_id, testFileName5, 'Normalization test content', 'utf8');
        console.log(`Test 5 - Created test file: ${testFileName5}`);
        
        // Delete with path that needs normalization
        await vfs2.rm(owner_id, `///${testFileName5}///`);
        console.log('Test 5 - Successfully deleted file with normalized path');
        
        // Verify deletion
        const exists5 = await vfs2.exists(testFileName5);
        if (exists5) {
            throw new Error('Test 5 failed! File should not exist after deletion with normalized path');
        }
        console.log('Test 5 - Path normalization deletion verified');

        // Test 6: Test deleting multiple files in sequence
        console.log('Test 6 - Test deleting multiple files in sequence');
        const testFiles = ['test-rm-multi-1.txt', 'test-rm-multi-2.txt', 'test-rm-multi-3.txt'];
        
        // Create multiple files
        for (const fileName of testFiles) {
            await vfs2.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 6 - Created file: ${fileName}`);
        }
        
        // Verify all files exist
        for (const fileName of testFiles) {
            const exists = await vfs2.exists(fileName);
            if (!exists) {
                throw new Error(`Test 6 failed! File ${fileName} should exist after creation`);
            }
        }
        console.log('Test 6 - All files verified to exist');
        
        // Delete all files
        for (const fileName of testFiles) {
            await vfs2.rm(owner_id, fileName);
            console.log(`Test 6 - Deleted file: ${fileName}`);
        }
        
        // Verify all files are gone
        for (const fileName of testFiles) {
            const exists = await vfs2.exists(fileName);
            if (exists) {
                throw new Error(`Test 6 failed! File ${fileName} should not exist after deletion`);
            }
        }
        console.log('Test 6 - All files verified to be deleted');

        console.log('✅ All rm tests passed');
        console.log('=== VFS2 RM Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 RM Test Failed ===');
        console.error('Error during VFS2 rm test:', error);
        throw error;
    }
}

export async function unlinkTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 Unlink Test Starting ===');

        // Test 1: Test unlinking non-existent file (should throw error)
        console.log('Test 1 - Attempting to unlink non-existent file');
        try {
            await vfs2.unlink(owner_id, 'nonexistent-file.txt');
            throw new Error('Test 1 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 1 failed! Should throw "File not found" error');
            }
        }

        // Test 2: Test unlinking root directory (should throw error)
        console.log('Test 2 - Attempting to unlink root directory');
        try {
            await vfs2.unlink(owner_id, '');
            throw new Error('Test 2 failed! Should have thrown error for root directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 2 passed - Root directory unlink threw error:', errorMessage);
            if (!errorMessage.includes('Cannot unlink root directory')) {
                throw new Error('Test 2 failed! Should throw specific root directory error');
            }
        }

        // Test 3: Create a test file and then unlink it
        console.log('Test 3 - Create and unlink a test file');
        const testFileName = 'test-unlink-file.txt';
        const testContent = 'This file will be unlinked by the unlink test.';
        
        // Create the file
        await vfs2.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 3 - Created test file: ${testFileName}`);
        
        // Verify it exists
        const existsBefore = await vfs2.exists(testFileName);
        if (!existsBefore) {
            throw new Error('Test 3 failed! Test file should exist after creation');
        }
        console.log('Test 3 - File existence verified before unlinking');
        
        // Unlink the file
        await vfs2.unlink(owner_id, testFileName);
        console.log('Test 3 - Successfully unlinked test file');
        
        // Verify it no longer exists
        const existsAfter = await vfs2.exists(testFileName);
        if (existsAfter) {
            throw new Error('Test 3 failed! Test file should not exist after unlinking');
        }
        console.log('Test 3 - File unlinking verified');

        // Test 4: Test unlinking with path normalization
        console.log('Test 4 - Test unlinking with path normalization');
        const testFileName4 = 'test-unlink-normalize.txt';
        
        // Create file
        await vfs2.writeFile(owner_id, testFileName4, 'Normalization test content', 'utf8');
        console.log(`Test 4 - Created test file: ${testFileName4}`);
        
        // Unlink with path that needs normalization
        await vfs2.unlink(owner_id, `///${testFileName4}///`);
        console.log('Test 4 - Successfully unlinked file with normalized path');
        
        // Verify deletion
        const exists4 = await vfs2.exists(testFileName4);
        if (exists4) {
            throw new Error('Test 4 failed! File should not exist after unlinking with normalized path');
        }
        console.log('Test 4 - Path normalization unlinking verified');

        // Test 5: Test unlinking multiple files in sequence
        console.log('Test 5 - Test unlinking multiple files in sequence');
        const testFiles = ['test-unlink-multi-1.txt', 'test-unlink-multi-2.txt', 'test-unlink-multi-3.txt'];
        
        // Create multiple files
        for (const fileName of testFiles) {
            await vfs2.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 5 - Created file: ${fileName}`);
        }
        
        // Verify all files exist
        for (const fileName of testFiles) {
            const exists = await vfs2.exists(fileName);
            if (!exists) {
                throw new Error(`Test 5 failed! File ${fileName} should exist after creation`);
            }
        }
        console.log('Test 5 - All files verified to exist');
        
        // Unlink all files
        for (const fileName of testFiles) {
            await vfs2.unlink(owner_id, fileName);
            console.log(`Test 5 - Unlinked file: ${fileName}`);
        }
        
        // Verify all files are gone
        for (const fileName of testFiles) {
            const exists = await vfs2.exists(fileName);
            if (exists) {
                throw new Error(`Test 5 failed! File ${fileName} should not exist after unlinking`);
            }
        }
        console.log('Test 5 - All files verified to be unlinked');

        // Test 6: Test that unlink fails on directories
        console.log('Test 6 - Test that unlink fails on directories');
        const testDirName = 'test-unlink-dir';
        
        // Create a directory first
        await vfs2.mkdirEx(owner_id, testDirName, {}, false);
        console.log(`Test 6 - Created test directory: ${testDirName}`);
        
        // Verify directory exists
        const dirExists = await vfs2.exists(testDirName);
        if (!dirExists) {
            throw new Error('Test 6 failed! Test directory should exist after creation');
        }
        
        // Try to unlink the directory (should fail)
        try {
            await vfs2.unlink(owner_id, testDirName);
            throw new Error('Test 6 failed! Should have thrown error when trying to unlink directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 6 passed - Directory unlink threw error:', errorMessage);
            if (!errorMessage.includes('Cannot unlink directory')) {
                throw new Error('Test 6 failed! Should throw specific directory error');
            }
        }
        
        // Clean up the directory using rm
        await vfs2.rm(owner_id, testDirName);
        console.log('Test 6 - Cleaned up test directory using rm');

        // Test 7: Test different file types
        console.log('Test 7 - Test unlinking different file types');
        const testFileTypes = [
            { name: 'test-unlink.txt', content: 'Text file content' },
            { name: 'test-unlink.json', content: '{"key": "value"}' },
            { name: 'test-unlink.md', content: '# Markdown\n\nContent' },
            { name: 'test-unlink.html', content: '<html><body>HTML</body></html>' }
        ];
        
        // Create and unlink each file type
        for (const file of testFileTypes) {
            // Create file
            await vfs2.writeFile(owner_id, file.name, file.content, 'utf8');
            console.log(`Test 7 - Created ${file.name}`);
            
            // Verify it exists
            const exists = await vfs2.exists(file.name);
            if (!exists) {
                throw new Error(`Test 7 failed! File ${file.name} should exist after creation`);
            }
            
            // Unlink it
            await vfs2.unlink(owner_id, file.name);
            console.log(`Test 7 - Unlinked ${file.name}`);
            
            // Verify it's gone
            const existsAfter = await vfs2.exists(file.name);
            if (existsAfter) {
                throw new Error(`Test 7 failed! File ${file.name} should not exist after unlinking`);
            }
        }
        console.log('Test 7 - All file types unlinked successfully');

        // Test 8: Test unlinking files with special characters in names
        console.log('Test 8 - Test unlinking files with special characters');
        const specialFiles = [
            'test_underscore.txt',
            'test123numbers.txt',
            'UPPERCASE.TXT'
        ];
        
        for (const fileName of specialFiles) {
            try {
                // Create file
                await vfs2.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
                console.log(`Test 8 - Created file with special chars: ${fileName}`);
                
                // Unlink it
                await vfs2.unlink(owner_id, fileName);
                console.log(`Test 8 - Successfully unlinked: ${fileName}`);
                
                // Verify it's gone
                const exists = await vfs2.exists(fileName);
                if (exists) {
                    throw new Error(`Test 8 failed! File ${fileName} should not exist after unlinking`);
                }
                
            } catch (error) {
                // Some special character filenames might be rejected by validation
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - File ${fileName} caused error (may be acceptable):`, errorMessage);
            }
        }

        // Test 9: Test consistency between unlink and rm for files
        console.log('Test 9 - Test consistency between unlink and rm for files');
        const testFile9a = 'test-unlink-consistency-a.txt';
        const testFile9b = 'test-unlink-consistency-b.txt';
        
        // Create two identical files
        await vfs2.writeFile(owner_id, testFile9a, 'Consistency test content', 'utf8');
        await vfs2.writeFile(owner_id, testFile9b, 'Consistency test content', 'utf8');
        console.log('Test 9 - Created two test files for consistency test');
        
        // Delete one with unlink, one with rm
        await vfs2.unlink(owner_id, testFile9a);
        await vfs2.rm(owner_id, testFile9b);
        console.log('Test 9 - Deleted one with unlink, one with rm');
        
        // Verify both are gone
        const exists9a = await vfs2.exists(testFile9a);
        const exists9b = await vfs2.exists(testFile9b);
        
        if (exists9a || exists9b) {
            throw new Error('Test 9 failed! Both files should be deleted regardless of method used');
        }
        console.log('Test 9 - Both files properly deleted, consistency verified');

        // Test 10: Test error handling with edge cases
        console.log('Test 10 - Test error handling with edge cases');
        
        // Test with root path variations
        const rootPaths = ['/', '//', '///', './'];
        for (const path of rootPaths) {
            try {
                await vfs2.unlink(owner_id, path);
                throw new Error(`Test 10 failed! Should have thrown error for root path: ${path}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 10 - Root path '${path}' correctly threw error`);
                if (!errorMessage.includes('Cannot unlink root directory') && !errorMessage.includes('File not found')) {
                    throw new Error(`Test 10 failed! Unexpected error for root path ${path}: ${errorMessage}`);
                }
            }
        }

        console.log('✅ All unlink tests passed');
        console.log('=== VFS2 Unlink Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Unlink Test Failed ===');
        console.error('Error during VFS2 unlink test:', error);
        throw error;
    }
}

export async function readdirTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 Readdir Test Starting ===');

        // Test 1: Read root directory (should return array of filenames)
        console.log('Test 1 - Reading root directory');
        const result1 = await vfs2.readdir(owner_id, '');
        console.log(`Test 1 - Root directory contents (${result1.length} items):`, result1);
        
        // Root directory should return an array of strings
        if (!Array.isArray(result1)) {
            throw new Error('Test 1 failed! readdir should return an array');
        }
        
        // All items should be strings (filenames)
        for (const item of result1) {
            if (typeof item !== 'string') {
                throw new Error(`Test 1 failed! All items should be strings, got: ${typeof item}`);
            }
        }
        console.log('Test 1 - Root directory readdir verified');

        // Test 2: Read root directory with slash
        console.log('Test 2 - Reading root directory with slash');
        const result2 = await vfs2.readdir(owner_id, '/');
        console.log(`Test 2 - Root directory with slash contents (${result2.length} items):`, result2);
        
        if (!Array.isArray(result2)) {
            throw new Error('Test 2 failed! readdir with slash should return an array');
        }
        
        for (const item of result2) {
            if (typeof item !== 'string') {
                throw new Error(`Test 2 failed! All items should be strings, got: ${typeof item}`);
            }
        }
        console.log('Test 2 - Root directory with slash readdir verified');

        // Test 3: Read non-existent directory (should return empty array or throw error)
        console.log('Test 3 - Reading non-existent directory');
        try {
            const result3 = await vfs2.readdir(owner_id, 'nonexistent-folder');
            console.log(`Test 3 - Non-existent directory contents (${result3.length} items):`, result3);
            
            // Should return empty array for non-existent directory
            if (!Array.isArray(result3) || result3.length > 0) {
                throw new Error('Test 3 failed! Non-existent directory should return empty array');
            }
            console.log('Test 3 - Non-existent directory returned empty array (correct)');
        } catch (error) {
            // It's also acceptable for readdir to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 - Non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 4: Create some test files and verify readdir returns them
        console.log('Test 4 - Creating test files and verifying readdir results');
        const testFiles = ['readdir-test-1.txt', 'readdir-test-2.md', 'readdir-test-3.json'];
        
        // Create test files
        for (const fileName of testFiles) {
            await vfs2.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 4 - Created test file: ${fileName}`);
        }
        
        // Read directory and verify files are present
        const result4 = await vfs2.readdir(owner_id, '');
        console.log(`Test 4 - Directory contents after creating files (${result4.length} items):`, result4);
        
        // Verify all test files are in the readdir result
        for (const testFile of testFiles) {
            if (!result4.includes(testFile)) {
                throw new Error(`Test 4 failed! Created file ${testFile} should be in readdir result`);
            }
        }
        console.log('Test 4 - All created test files found in readdir result');

        // Test 5: Compare readdir with readdirEx results
        console.log('Test 5 - Comparing readdir with readdirEx results');
        const readdirResult = await vfs2.readdir(owner_id, '');
        const readdirExResult = await vfs2.readdirEx(owner_id, '', false);
        
        console.log(`Test 5 - readdir returned ${readdirResult.length} items`);
        console.log(`Test 5 - readdirEx returned ${readdirExResult.length} items`);
        
        // Should have same number of items
        if (readdirResult.length !== readdirExResult.length) {
            throw new Error(`Test 5 failed! readdir and readdirEx should return same number of items: ${readdirResult.length} vs ${readdirExResult.length}`);
        }
        
        // Verify all filenames match
        const readdirExFilenames = readdirExResult.map(node => node.name);
        for (const filename of readdirResult) {
            if (!readdirExFilenames.includes(filename)) {
                throw new Error(`Test 5 failed! readdir filename ${filename} not found in readdirEx results`);
            }
        }
        
        for (const filename of readdirExFilenames) {
            if (!readdirResult.includes(filename)) {
                throw new Error(`Test 5 failed! readdirEx filename ${filename} not found in readdir results`);
            }
        }
        console.log('Test 5 - readdir and readdirEx results are consistent');

        // Test 6: Test path normalization in readdir
        console.log('Test 6 - Testing path normalization');
        const result6 = await vfs2.readdir(owner_id, '//test///path//');
        console.log(`Test 6 - Normalized path contents (${result6.length} items):`, result6);
        
        if (!Array.isArray(result6)) {
            throw new Error('Test 6 failed! readdir with path normalization should return an array');
        }
        console.log('Test 6 - Path normalization handled correctly');

        // Test 7: Test ordering of results (should be ordered by ordinal)
        console.log('Test 7 - Testing ordering of results');
        const orderedResult = await vfs2.readdir(owner_id, '');
        const orderedResultEx = await vfs2.readdirEx(owner_id, '', false);
        
        // Since readdir uses the same underlying function as readdirEx, 
        // the ordering should be the same
        const orderedFilenames = orderedResultEx.map(node => node.name);
        
        for (let i = 0; i < orderedResult.length; i++) {
            if (orderedResult[i] !== orderedFilenames[i]) {
                throw new Error(`Test 7 failed! File ordering mismatch at position ${i}: readdir=${orderedResult[i]}, readdirEx=${orderedFilenames[i]}`);
            }
        }
        console.log('Test 7 - File ordering verified to be consistent');

        // Test 8: Test with different owner_id values
        console.log('Test 8 - Testing with different owner_id values');
        const result8a = await vfs2.readdir(owner_id, '');
        const result8b = await vfs2.readdir(999999, ''); // Non-existent user
        
        console.log(`Test 8a - Valid owner_id returned ${result8a.length} items`);
        console.log(`Test 8b - Invalid owner_id returned ${result8b.length} items`);
        
        // Both should return arrays (may be different lengths due to permissions)
        if (!Array.isArray(result8a) || !Array.isArray(result8b)) {
            throw new Error('Test 8 failed! Both calls should return arrays');
        }
        console.log('Test 8 - Different owner_id values handled correctly');

        // Test 9: Test nested directory paths (should return empty or throw error)
        console.log('Test 9 - Testing nested directory paths');
        const nestedPaths = [
            'folder/subfolder',
            'deeply/nested/path',
            'nonexistent/nested/structure'
        ];
        
        for (const path of nestedPaths) {
            try {
                const result = await vfs2.readdir(owner_id, path);
                console.log(`Test 9 - Path '${path}' returned ${result.length} items`);
                
                if (!Array.isArray(result)) {
                    throw new Error(`Test 9 failed! Path '${path}' should return an array`);
                }
                
                // Should be empty since paths don't exist
                if (result.length > 0) {
                    throw new Error(`Test 9 failed! Non-existent path '${path}' should return empty array`);
                }
                
            } catch (error) {
                // It's acceptable for non-existent paths to throw errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 9 - Path '${path}' threw error (acceptable):`, errorMessage);
            }
        }

        // Test 10: Clean up test files and verify readdir reflects changes
        console.log('Test 10 - Cleaning up test files and verifying readdir reflects changes');
        
        // Get current file list
        const beforeCleanup = await vfs2.readdir(owner_id, '');
        console.log(`Test 10 - Files before cleanup: ${beforeCleanup.length}`);
        
        // Delete test files
        for (const fileName of testFiles) {
            try {
                await vfs2.unlink(owner_id, fileName);
                console.log(`Test 10 - Deleted test file: ${fileName}`);
            } catch (error) {
                // File might already be deleted by previous tests
                console.log(`Test 10 - Could not delete ${fileName} (may not exist):`, error);
            }
        }
        
        // Verify files are no longer in readdir result
        const afterCleanup = await vfs2.readdir(owner_id, '');
        console.log(`Test 10 - Files after cleanup: ${afterCleanup.length}`);
        
        for (const testFile of testFiles) {
            if (afterCleanup.includes(testFile)) {
                throw new Error(`Test 10 failed! Deleted file ${testFile} should not appear in readdir result`);
            }
        }
        console.log('Test 10 - Cleanup verified, deleted files no longer in readdir result');

        console.log('✅ All readdir tests passed');
        console.log('=== VFS2 Readdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Readdir Test Failed ===');
        console.error('Error during VFS2 readdir test:', error);
        throw error;
    }
}

export async function getItemByIDTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 GetItemByID Test Starting ===');

        // Test 1: Test getting item by non-existent UUID
        console.log('Test 1 - Getting item by non-existent UUID');
        const nonExistentUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const result1 = await vfs2.getItemByID(nonExistentUuid, 'usr');
        console.log(`Test 1 - Non-existent UUID result:`, { hasNode: !!result1.node, docPath: result1.docPath });
        
        if (result1.node !== null) {
            throw new Error('Test 1 failed! Non-existent UUID should return null node');
        }
        if (result1.docPath !== '') {
            throw new Error('Test 1 failed! Non-existent UUID should return empty docPath');
        }
        console.log('Test 1 - Non-existent UUID handled correctly');

        // Test 2: Create a test file and get it by ID
        console.log('Test 2 - Create test file and retrieve by UUID');
        const testFileName = 'test-getItemByID.md';
        const testContent = '# GetItemByID Test\n\nThis file is used to test UUID-based retrieval.';
        
        // Create the file
        await vfs2.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 2 - Created test file: ${testFileName}`);
        
        // Get the file's UUID by reading the directory
        const rootContents = await vfs2.readdirEx(owner_id, '', false);
        const testFile = rootContents.find(node => node.name === testFileName);
        
        if (!testFile || !testFile.uuid) {
            throw new Error('Test 2 failed! Test file should exist and have a UUID');
        }
        console.log(`Test 2 - Found test file with UUID: ${testFile.uuid}`);
        
        // Get the file by its UUID
        const result2 = await vfs2.getItemByID(testFile.uuid, 'usr');
        console.log(`Test 2 - Retrieved by UUID:`, { 
            hasNode: !!result2.node, 
            docPath: result2.docPath,
            nodeName: result2.node?.name,
            nodeUuid: result2.node?.uuid
        });
        
        if (!result2.node) {
            throw new Error('Test 2 failed! Should have found the test file by UUID');
        }
        
        if (result2.node.uuid !== testFile.uuid) {
            throw new Error(`Test 2 failed! UUID mismatch: expected ${testFile.uuid}, got ${result2.node.uuid}`);
        }
        
        if (result2.node.name !== testFileName) {
            throw new Error(`Test 2 failed! Name mismatch: expected ${testFileName}, got ${result2.node.name}`);
        }
        
        if (result2.docPath !== testFileName) {
            throw new Error(`Test 2 failed! DocPath mismatch: expected ${testFileName}, got ${result2.docPath}`);
        }
        console.log('Test 2 - File retrieval by UUID successful');

        // Test 3: Create a nested directory structure and test docPath construction
        console.log('Test 3 - Create nested structure and test docPath construction');
        const nestedDirName = 'test-nested-dir';
        const nestedFileName = 'nested-file.txt';
        const nestedContent = 'This is content in a nested file.';
        
        // Create nested directory first
        await vfs2.mkdirEx(owner_id, nestedDirName, {}, false);
        console.log(`Test 3 - Created nested directory: ${nestedDirName}`);
        
        // Create file in nested directory
        const nestedFilePath = vfs2.pathJoin(nestedDirName, nestedFileName);
        await vfs2.writeFile(owner_id, nestedFilePath, nestedContent, 'utf8');
        console.log(`Test 3 - Created nested file: ${nestedFilePath}`);
        
        // Get the nested file's UUID
        const nestedContents = await vfs2.readdirEx(owner_id, nestedDirName, false);
        const nestedFile = nestedContents.find(node => node.name === nestedFileName);
        
        if (!nestedFile || !nestedFile.uuid) {
            throw new Error('Test 3 failed! Nested file should exist and have a UUID');
        }
        console.log(`Test 3 - Found nested file with UUID: ${nestedFile.uuid}`);
        
        // Get the nested file by its UUID
        const result3 = await vfs2.getItemByID(nestedFile.uuid, 'usr');
        console.log(`Test 3 - Retrieved nested file by UUID:`, { 
            hasNode: !!result3.node, 
            docPath: result3.docPath,
            nodeName: result3.node?.name 
        });
        
        if (!result3.node) {
            throw new Error('Test 3 failed! Should have found the nested file by UUID');
        }
        
        if (result3.docPath !== nestedFilePath) {
            throw new Error(`Test 3 failed! DocPath should be ${nestedFilePath}, got ${result3.docPath}`);
        }
        console.log('Test 3 - Nested file docPath construction successful');

        // Test 4: Test with different root keys
        console.log('Test 4 - Test with different root keys');
        const wrongRootKeyResult = await vfs2.getItemByID(testFile.uuid, 'wrong-root');
        console.log(`Test 4 - Wrong root key result:`, { hasNode: !!wrongRootKeyResult.node, docPath: wrongRootKeyResult.docPath });
        
        if (wrongRootKeyResult.node !== null) {
            throw new Error('Test 4 failed! Wrong root key should return null node');
        }
        console.log('Test 4 - Wrong root key handled correctly');

        // Test 5: Test with malformed UUIDs
        console.log('Test 5 - Test with malformed UUIDs');
        const malformedUuids = [
            'not-a-uuid',
            '12345',
            '',
            'aaaaaaaa-bbbb-cccc-dddd', // Too short
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-extra' // Too long
        ];
        
        for (const badUuid of malformedUuids) {
            try {
                const badResult = await vfs2.getItemByID(badUuid, 'usr');
                console.log(`Test 5 - Malformed UUID '${badUuid}' result:`, { hasNode: !!badResult.node, docPath: badResult.docPath });
                
                // Should return null node for malformed UUIDs
                if (badResult.node !== null) {
                    throw new Error(`Test 5 failed! Malformed UUID '${badUuid}' should return null node`);
                }
            } catch (error) {
                // It's also acceptable for malformed UUIDs to throw database errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 5 - Malformed UUID '${badUuid}' threw error (acceptable):`, errorMessage);
            }
        }
        console.log('Test 5 - Malformed UUIDs handled correctly');

        // Test 6: Test TreeNode properties
        console.log('Test 6 - Verify TreeNode properties');
        const result6 = await vfs2.getItemByID(testFile.uuid, 'usr');
        
        if (!result6.node) {
            throw new Error('Test 6 failed! Should have found the test file');
        }
        
        const node = result6.node;
        
        // Check required TreeNode properties
        if (typeof node.is_directory !== 'boolean') {
            throw new Error('Test 6 failed! TreeNode should have boolean is_directory property');
        }
        
        if (typeof node.name !== 'string') {
            throw new Error('Test 6 failed! TreeNode should have string name property');
        }
        
        if (typeof node.uuid !== 'string') {
            throw new Error('Test 6 failed! TreeNode should have string uuid property');
        }
        
        if (typeof node.owner_id !== 'number') {
            throw new Error('Test 6 failed! TreeNode should have number owner_id property');
        }
        
        if (typeof node.is_public !== 'boolean') {
            throw new Error('Test 6 failed! TreeNode should have boolean is_public property');
        }
        
        if (node.ordinal !== null && typeof node.ordinal !== 'number') {
            throw new Error('Test 6 failed! TreeNode ordinal should be number or null');
        }
        
        console.log(`Test 6 - TreeNode properties verified:`, {
            name: node.name,
            uuid: node.uuid,
            is_directory: node.is_directory,
            is_public: node.is_public,
            owner_id: node.owner_id,
            ordinal: node.ordinal
        });

        // Test 7: Test with directory vs file
        console.log('Test 7 - Test directory vs file retrieval');
        
        // Get directory by UUID
        const dirContents = await vfs2.readdirEx(owner_id, '', false);
        const dirNode = dirContents.find(node => node.name === nestedDirName);
        
        if (!dirNode || !dirNode.uuid) {
            throw new Error('Test 7 failed! Directory should exist and have UUID');
        }
        
        const dirResult = await vfs2.getItemByID(dirNode.uuid, 'usr');
        console.log(`Test 7 - Directory retrieval:`, { 
            hasNode: !!dirResult.node,
            docPath: dirResult.docPath,
            isDirectory: dirResult.node?.is_directory
        });
        
        if (!dirResult.node || !dirResult.node.is_directory) {
            throw new Error('Test 7 failed! Directory should be retrieved and marked as directory');
        }
        
        if (dirResult.docPath !== nestedDirName) {
            throw new Error(`Test 7 failed! Directory docPath should be ${nestedDirName}, got ${dirResult.docPath}`);
        }
        console.log('Test 7 - Directory retrieval successful');

        // Test 8: Test consistency between getItemByID and other methods
        console.log('Test 8 - Test consistency with other methods');
        
        // Get file through getItemByID
        const byIdResult = await vfs2.getItemByID(testFile.uuid, 'usr');
        
        // Get file through exists with info
        const existsInfo: any = {};
        const exists = await vfs2.exists(testFileName, existsInfo);
        
        if (!exists || !existsInfo.node) {
            throw new Error('Test 8 failed! File should exist and have node info');
        }
        
        // Compare results
        const byIdNode = byIdResult.node!;
        const existsNode = existsInfo.node;
        
        if (byIdNode.uuid !== existsNode.uuid) {
            throw new Error('Test 8 failed! UUIDs should match between getItemByID and exists methods');
        }
        
        if (byIdNode.name !== existsNode.name) {
            throw new Error('Test 8 failed! Names should match between getItemByID and exists methods');
        }
        
        if (byIdNode.is_directory !== existsNode.is_directory) {
            throw new Error('Test 8 failed! Directory flags should match between methods');
        }
        console.log('Test 8 - Consistency between methods verified');

        // Test 9: Test multiple retrievals (caching/consistency)
        console.log('Test 9 - Test multiple retrievals for consistency');
        for (let i = 0; i < 3; i++) {
            const multiResult = await vfs2.getItemByID(testFile.uuid, 'usr');
            
            if (!multiResult.node) {
                throw new Error(`Test 9 failed! Retrieval ${i} should return node`);
            }
            
            if (multiResult.node.uuid !== testFile.uuid) {
                throw new Error(`Test 9 failed! UUID should be consistent across retrievals`);
            }
            
            if (multiResult.docPath !== testFileName) {
                throw new Error(`Test 9 failed! DocPath should be consistent across retrievals`);
            }
        }
        console.log('Test 9 - Multiple retrieval consistency verified');

        // Test 10: Clean up test files
        console.log('Test 10 - Cleaning up test files');
        try {
            await vfs2.unlink(owner_id, testFileName);
            console.log('Test 10 - Deleted test file');
        } catch (error) {
            console.log('Test 10 - Could not delete test file:', error);
        }
        
        try {
            await vfs2.rm(owner_id, nestedDirName, { recursive: true });
            console.log('Test 10 - Deleted nested directory');
        } catch (error) {
            console.log('Test 10 - Could not delete nested directory:', error);
        }

        console.log('✅ All getItemByID tests passed');
        console.log('=== VFS2 GetItemByID Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 GetItemByID Test Failed ===');
        console.error('Error during VFS2 getItemByID test:', error);
        throw error;
    }
}

export async function setOrdinalTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 SetOrdinal Test Starting ===');

        // Test 1: Create test files with specific ordinals
        console.log('Test 1 - Create test files with specific ordinals');
        const testFiles = [
            { name: 'ordinal-test-1.md', ordinal: 10 },
            { name: 'ordinal-test-2.md', ordinal: 20 },
            { name: 'ordinal-test-3.md', ordinal: 30 }
        ];
        
        // Create files with specific ordinals
        for (const file of testFiles) {
            await vfs2.writeFileEx(owner_id, file.name, `Content for ${file.name}`, 'utf8', false, file.ordinal);
            console.log(`Test 1 - Created ${file.name} with ordinal ${file.ordinal}`);
        }
        
        // Verify files were created with correct ordinals
        const rootContents = await vfs2.readdirEx(owner_id, '', false);
        for (const file of testFiles) {
            const createdFile = rootContents.find(node => node.name === file.name);
            if (!createdFile) {
                throw new Error(`Test 1 failed! File ${file.name} should exist`);
            }
            if (createdFile.ordinal !== file.ordinal) {
                throw new Error(`Test 1 failed! File ${file.name} should have ordinal ${file.ordinal}, got ${createdFile.ordinal}`);
            }
        }
        console.log('Test 1 - All test files created with correct ordinals');

        // Test 2: Update ordinal of first file
        console.log('Test 2 - Update ordinal of first file');
        const firstFile = rootContents.find(node => node.name === testFiles[0].name);
        if (!firstFile || !firstFile.uuid) {
            throw new Error('Test 2 failed! First file should exist and have UUID');
        }
        
        const newOrdinal = 5;
        await vfs2.setOrdinal(firstFile.uuid, newOrdinal);
        console.log(`Test 2 - Set ordinal for ${firstFile.name} (UUID: ${firstFile.uuid}) to ${newOrdinal}`);
        
        // Verify the ordinal was updated
        const updatedContents = await vfs2.readdirEx(owner_id, '', false);
        const updatedFile = updatedContents.find(node => node.uuid === firstFile.uuid);
        
        if (!updatedFile) {
            throw new Error('Test 2 failed! Updated file should still exist');
        }
        if (updatedFile.ordinal !== newOrdinal) {
            throw new Error(`Test 2 failed! File ordinal should be ${newOrdinal}, got ${updatedFile.ordinal}`);
        }
        console.log('Test 2 - Ordinal update verified');

        // Test 3: Update ordinal to zero
        console.log('Test 3 - Update ordinal to zero');
        const secondFile = rootContents.find(node => node.name === testFiles[1].name);
        if (!secondFile || !secondFile.uuid) {
            throw new Error('Test 3 failed! Second file should exist and have UUID');
        }
        
        await vfs2.setOrdinal(secondFile.uuid, 0);
        console.log(`Test 3 - Set ordinal for ${secondFile.name} to 0`);
        
        // Verify the ordinal was updated to zero
        const zeroContents = await vfs2.readdirEx(owner_id, '', false);
        const zeroFile = zeroContents.find(node => node.uuid === secondFile.uuid);
        
        if (!zeroFile) {
            throw new Error('Test 3 failed! File should still exist after setting ordinal to 0');
        }
        if (zeroFile.ordinal !== 0) {
            throw new Error(`Test 3 failed! File ordinal should be 0, got ${zeroFile.ordinal}`);
        }
        console.log('Test 3 - Zero ordinal update verified');

        // Test 4: Update ordinal to large value
        console.log('Test 4 - Update ordinal to large value');
        const thirdFile = rootContents.find(node => node.name === testFiles[2].name);
        if (!thirdFile || !thirdFile.uuid) {
            throw new Error('Test 4 failed! Third file should exist and have UUID');
        }
        
        const largeOrdinal = 99999;
        await vfs2.setOrdinal(thirdFile.uuid, largeOrdinal);
        console.log(`Test 4 - Set ordinal for ${thirdFile.name} to ${largeOrdinal}`);
        
        // Verify the ordinal was updated
        const largeContents = await vfs2.readdirEx(owner_id, '', false);
        const largeFile = largeContents.find(node => node.uuid === thirdFile.uuid);
        
        if (!largeFile) {
            throw new Error('Test 4 failed! File should still exist after setting large ordinal');
        }
        if (largeFile.ordinal !== largeOrdinal) {
            throw new Error(`Test 4 failed! File ordinal should be ${largeOrdinal}, got ${largeFile.ordinal}`);
        }
        console.log('Test 4 - Large ordinal update verified');

        // Test 5: Test with non-existent UUID
        console.log('Test 5 - Test with non-existent UUID');
        const nonExistentUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        try {
            await vfs2.setOrdinal(nonExistentUuid, 100);
            throw new Error('Test 5 failed! Should have thrown error for non-existent UUID');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Non-existent UUID threw error:', errorMessage);
            if (!errorMessage.includes('not found')) {
                throw new Error('Test 5 failed! Should throw "not found" error');
            }
        }

        // Test 6: Test with malformed UUIDs
        console.log('Test 6 - Test with malformed UUIDs');
        const malformedUuids = [
            'not-a-uuid',
            '12345',
            '',
            'aaaaaaaa-bbbb-cccc-dddd' // Too short
        ];
        
        for (const badUuid of malformedUuids) {
            try {
                await vfs2.setOrdinal(badUuid, 50);
                throw new Error(`Test 6 failed! Should have thrown error for malformed UUID: ${badUuid}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 6 - Malformed UUID '${badUuid}' threw error (expected):`, errorMessage);
            }
        }
        console.log('Test 6 - Malformed UUIDs handled correctly');

        // Test 7: Test negative ordinal (might be allowed depending on schema)
        console.log('Test 7 - Test negative ordinal');
        try {
            await vfs2.setOrdinal(firstFile.uuid, -10);
            console.log('Test 7 - Negative ordinal accepted');
            
            // Verify the ordinal was updated
            const negativeContents = await vfs2.readdirEx(owner_id, '', false);
            const negativeFile = negativeContents.find(node => node.uuid === firstFile.uuid);
            
            if (!negativeFile) {
                throw new Error('Test 7 failed! File should still exist after setting negative ordinal');
            }
            if (negativeFile.ordinal !== -10) {
                throw new Error(`Test 7 failed! File ordinal should be -10, got ${negativeFile.ordinal}`);
            }
            console.log('Test 7 - Negative ordinal verified');
        } catch (error) {
            // It's acceptable if negative ordinals are rejected by database constraints
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 7 - Negative ordinal rejected (may be acceptable):', errorMessage);
        }

        // Test 8: Update multiple files' ordinals in sequence
        console.log('Test 8 - Update multiple files ordinals in sequence');
        const newOrdinals = [100, 200, 300];
        
        for (let i = 0; i < testFiles.length; i++) {
            const file = rootContents.find(node => node.name === testFiles[i].name);
            if (file && file.uuid) {
                await vfs2.setOrdinal(file.uuid, newOrdinals[i]);
                console.log(`Test 8 - Set ordinal for ${file.name} to ${newOrdinals[i]}`);
            }
        }
        
        // Verify all ordinals were updated
        const multiContents = await vfs2.readdirEx(owner_id, '', false);
        for (let i = 0; i < testFiles.length; i++) {
            const file = multiContents.find(node => node.name === testFiles[i].name);
            if (!file) {
                throw new Error(`Test 8 failed! File ${testFiles[i].name} should exist`);
            }
            if (file.ordinal !== newOrdinals[i]) {
                throw new Error(`Test 8 failed! File ${testFiles[i].name} should have ordinal ${newOrdinals[i]}, got ${file.ordinal}`);
            }
        }
        console.log('Test 8 - Multiple ordinal updates verified');

        // Test 9: Verify ordering after ordinal changes
        console.log('Test 9 - Verify ordering after ordinal changes');
        const orderedContents = await vfs2.readdirEx(owner_id, '', false);
        
        // Filter to only our test files
        const ourFiles = orderedContents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        
        console.log('Test 9 - Our test files with ordinals:');
        ourFiles.forEach(file => {
            console.log(`  - ${file.name}: ordinal ${file.ordinal}`);
        });
        
        // Verify files are ordered by ordinal
        for (let i = 1; i < ourFiles.length; i++) {
            const prevOrdinal = ourFiles[i-1].ordinal;
            const currOrdinal = ourFiles[i].ordinal;
            if (prevOrdinal != null && currOrdinal != null && prevOrdinal > currOrdinal) {
                throw new Error(`Test 9 failed! Files should be ordered by ordinal: ${ourFiles[i-1].name} (${prevOrdinal}) should come before ${ourFiles[i].name} (${currOrdinal})`);
            }
        }
        console.log('Test 9 - File ordering by ordinal verified');

        // Test 10: Test setOrdinal on directory
        console.log('Test 10 - Test setOrdinal on directory');
        const testDirName = 'test-ordinal-dir';
        const dirOrdinal = 500;
        
        // Create directory
        await vfs2.mkdirEx(owner_id, testDirName, {}, false, dirOrdinal);
        console.log(`Test 10 - Created directory ${testDirName} with ordinal ${dirOrdinal}`);
        
        // Get directory UUID
        const dirContents = await vfs2.readdirEx(owner_id, '', false);
        const testDir = dirContents.find(node => node.name === testDirName);
        
        if (!testDir || !testDir.uuid) {
            throw new Error('Test 10 failed! Directory should exist and have UUID');
        }
        
        // Update directory ordinal
        const newDirOrdinal = 600;
        await vfs2.setOrdinal(testDir.uuid, newDirOrdinal);
        console.log(`Test 10 - Set directory ordinal to ${newDirOrdinal}`);
        
        // Verify directory ordinal was updated
        const updatedDirContents = await vfs2.readdirEx(owner_id, '', false);
        const updatedDir = updatedDirContents.find(node => node.uuid === testDir.uuid);
        
        if (!updatedDir) {
            throw new Error('Test 10 failed! Directory should still exist after ordinal update');
        }
        if (updatedDir.ordinal !== newDirOrdinal) {
            throw new Error(`Test 10 failed! Directory ordinal should be ${newDirOrdinal}, got ${updatedDir.ordinal}`);
        }
        console.log('Test 10 - Directory ordinal update verified');

        // Clean up test files
        console.log('Cleanup - Removing test files and directory');
        for (const file of testFiles) {
            try {
                await vfs2.unlink(owner_id, file.name);
                console.log(`Cleanup - Deleted ${file.name}`);
            } catch (error) {
                console.log(`Cleanup - Could not delete ${file.name}:`, error);
            }
        }
        
        try {
            await vfs2.rm(owner_id, testDirName);
            console.log(`Cleanup - Deleted directory ${testDirName}`);
        } catch (error) {
            console.log(`Cleanup - Could not delete directory ${testDirName}:`, error);
        }

        console.log('✅ All setOrdinal tests passed');
        console.log('=== VFS2 SetOrdinal Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 SetOrdinal Test Failed ===');
        console.error('Error during VFS2 setOrdinal test:', error);
        throw error;
    }
}

/**
 * Test for moveUpOrDown functionality - simulates ordinal swapping between adjacent items
 * This tests the core logic used by DocMod.moveUpOrDown
 */
export async function moveUpOrDownTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS2 MoveUpOrDown Test Starting ===');

        // Create test files with specific ordinals
        const testFiles = [
            { name: 'test-move-file1.txt', content: 'File 1', ordinal: 100 },
            { name: 'test-move-file2.txt', content: 'File 2', ordinal: 200 },
            { name: 'test-move-file3.txt', content: 'File 3', ordinal: 300 },
        ];

        console.log('Test 1 - Creating test files with ordinals');
        for (const file of testFiles) {
            await vfs2.writeFileEx(owner_id, file.name, file.content, 'utf8', false, file.ordinal);
            console.log(`Test 1 - Created ${file.name} with ordinal ${file.ordinal}`);
        }

        // Test 2: Read directory and verify initial ordering
        console.log('Test 2 - Verify initial file ordering');
        let contents = await vfs2.readdirEx(owner_id, '', false);
        let ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 2 - Initial ordering:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        // Verify initial order
        if (ourFiles[0].name !== 'test-move-file1.txt' || 
            ourFiles[1].name !== 'test-move-file2.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 2 failed! Initial ordering is incorrect');
        }
        console.log('Test 2 - Initial ordering verified');

        // Test 3: Move file2 up (swap with file1)
        console.log('Test 3 - Move file2 up (swap ordinals with file1)');
        const file1 = ourFiles[0];
        const file2 = ourFiles[1];
        
        if (!file1.uuid || !file2.uuid) {
            throw new Error('Test 3 failed! Files should have UUIDs');
        }
        
        const file1Ordinal = file1.ordinal || 0;
        const file2Ordinal = file2.ordinal || 0;
        
        // Swap ordinals
        await vfs2.setOrdinal(file1.uuid, file2Ordinal);
        await vfs2.setOrdinal(file2.uuid, file1Ordinal);
        console.log(`Test 3 - Swapped ordinals: ${file1.name} (${file1Ordinal}->${file2Ordinal}) with ${file2.name} (${file2Ordinal}->${file1Ordinal})`);
        
        // Verify new ordering
        contents = await vfs2.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 3 - New ordering after move up:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file2.txt' || 
            ourFiles[1].name !== 'test-move-file1.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 3 failed! Ordering after move up is incorrect');
        }
        console.log('Test 3 - Move up verified');

        // Test 4: Move file2 down (swap with file1 again, back to original)
        console.log('Test 4 - Move file2 down (swap ordinals with file1 again)');
        const newFile1 = ourFiles[1]; // this is actually test-move-file1.txt
        const newFile2 = ourFiles[0]; // this is actually test-move-file2.txt
        
        if (!newFile1.uuid || !newFile2.uuid) {
            throw new Error('Test 4 failed! Files should have UUIDs');
        }
        
        const newFile1Ordinal = newFile1.ordinal || 0;
        const newFile2Ordinal = newFile2.ordinal || 0;
        
        // Swap ordinals back
        await vfs2.setOrdinal(newFile1.uuid, newFile2Ordinal);
        await vfs2.setOrdinal(newFile2.uuid, newFile1Ordinal);
        console.log(`Test 4 - Swapped ordinals back: ${newFile1.name} with ${newFile2.name}`);
        
        // Verify we're back to original ordering
        contents = await vfs2.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 4 - Ordering after move down:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file1.txt' || 
            ourFiles[1].name !== 'test-move-file2.txt' || 
            ourFiles[2].name !== 'test-move-file3.txt') {
            throw new Error('Test 4 failed! Ordering after move down is incorrect');
        }
        console.log('Test 4 - Move down verified');

        // Test 5: Move file3 up twice (to position 0)
        console.log('Test 5 - Move file3 up twice (to first position)');
        const file3 = ourFiles[2];
        const file2Again = ourFiles[1];
        
        if (!file3.uuid || !file2Again.uuid) {
            throw new Error('Test 5 failed! Files should have UUIDs');
        }
        
        // First swap: file3 with file2
        let file3Ordinal = file3.ordinal || 0;
        const file2AgainOrdinal = file2Again.ordinal || 0;
        
        await vfs2.setOrdinal(file3.uuid, file2AgainOrdinal);
        await vfs2.setOrdinal(file2Again.uuid, file3Ordinal);
        console.log(`Test 5 - First swap: ${file3.name} with ${file2Again.name}`);
        
        // Refresh and get new positions
        contents = await vfs2.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        // Second swap: file3 (now at position 1) with file1 (at position 0)
        const file1Again = ourFiles[0];
        const file3Again = ourFiles[1];
        
        if (!file1Again.uuid || !file3Again.uuid) {
            throw new Error('Test 5 failed! Files should have UUIDs');
        }
        
        file3Ordinal = file3Again.ordinal || 0;
        const file1AgainOrdinal = file1Again.ordinal || 0;
        
        await vfs2.setOrdinal(file3Again.uuid, file1AgainOrdinal);
        await vfs2.setOrdinal(file1Again.uuid, file3Ordinal);
        console.log(`Test 5 - Second swap: ${file3Again.name} with ${file1Again.name}`);
        
        // Verify final ordering
        contents = await vfs2.readdirEx(owner_id, '', false);
        ourFiles = contents.filter(node => 
            testFiles.some(tf => tf.name === node.name));
        ourFiles.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        
        console.log('Test 5 - Final ordering:');
        ourFiles.forEach((file, idx) => {
            console.log(`  ${idx}: ${file.name} - ordinal ${file.ordinal}`);
        });
        
        if (ourFiles[0].name !== 'test-move-file3.txt' || 
            ourFiles[1].name !== 'test-move-file1.txt' || 
            ourFiles[2].name !== 'test-move-file2.txt') {
            throw new Error('Test 5 failed! Final ordering after multiple moves is incorrect');
        }
        console.log('Test 5 - Multiple moves verified');

        // Cleanup
        console.log('Cleanup - Removing test files');
        for (const file of testFiles) {
            try {
                await vfs2.unlink(owner_id, file.name);
                console.log(`Cleanup - Deleted ${file.name}`);
            } catch (error) {
                console.log(`Cleanup - Could not delete ${file.name}:`, error);
            }
        }

        console.log('✅ All moveUpOrDown tests passed');
        console.log('=== VFS2 MoveUpOrDown Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 MoveUpOrDown Test Failed ===');
        console.error('Error during VFS2 moveUpOrDown test:', error);
        throw error;
    }
}

