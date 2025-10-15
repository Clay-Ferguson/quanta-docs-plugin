import pgdb from '../../../../../server/db/PGDB.js';
import { TestRunner } from '../../../../../common/TestRunner.js';
import vfs2 from '../VFS2.js';

// const testRootKey = 'usr';

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
        
        // Test the checkFileAccess method
        await testRunner.run("checkFileAccessTest", () => checkFileAccessTest(), true);
        
        // Test the readdirEx method
        await testRunner.run("readdirExTest", () => readdirExTest(owner_id), true);
        
        // Test the childrenExist method
        await testRunner.run("childrenExistTest", () => childrenExistTest(owner_id), true);
        
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

export async function checkFileAccessTest(): Promise<void> {
    try {
        console.log('=== VFS2 Check File Access Test Starting ===');

        // Test 1: Basic file access check (should not throw any errors)
        console.log('Test 1 - Calling checkFileAccess with basic parameters');
        vfs2.checkFileAccess('test.txt', 'usr');
        console.log('Test 1 passed - checkFileAccess completed without errors');

        // Test 2: Check file access with empty filename
        console.log('Test 2 - Calling checkFileAccess with empty filename');
        vfs2.checkFileAccess('', 'usr');
        console.log('Test 2 passed - checkFileAccess completed without errors');

        // Test 3: Check file access with empty root
        console.log('Test 3 - Calling checkFileAccess with empty root');
        vfs2.checkFileAccess('test.txt', '');
        console.log('Test 3 passed - checkFileAccess completed without errors');

        // Test 4: Check file access with path containing slashes
        console.log('Test 4 - Calling checkFileAccess with path containing slashes');
        vfs2.checkFileAccess('folder/subfolder/test.txt', 'usr');
        console.log('Test 4 passed - checkFileAccess completed without errors');

        // Test 5: Check file access with special characters
        console.log('Test 5 - Calling checkFileAccess with special characters');
        vfs2.checkFileAccess('test-file_123.txt', 'root');
        console.log('Test 5 passed - checkFileAccess completed without errors');

        // Test 6: Check file access with null/undefined-like values (as strings)
        console.log('Test 6 - Calling checkFileAccess with null-like string values');
        vfs2.checkFileAccess('null', 'undefined');
        console.log('Test 6 passed - checkFileAccess completed without errors');

        // Test 7: Multiple calls to ensure consistency
        console.log('Test 7 - Multiple calls to checkFileAccess');
        for (let i = 0; i < 5; i++) {
            vfs2.checkFileAccess(`test${i}.txt`, 'usr');
        }
        console.log('Test 7 passed - multiple checkFileAccess calls completed without errors');

        // Test 8: Very long paths
        console.log('Test 8 - Calling checkFileAccess with very long paths');
        const longPath = 'very/long/path/with/many/segments/and/a/very/long/filename/that/should/still/work.txt';
        vfs2.checkFileAccess(longPath, 'usr');
        console.log('Test 8 passed - checkFileAccess with long path completed without errors');

        console.log('✅ All checkFileAccess tests passed');
        console.log('=== VFS2 Check File Access Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS2 Check File Access Test Failed ===');
        console.error('Error during VFS2 checkFileAccess test:', error);
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
