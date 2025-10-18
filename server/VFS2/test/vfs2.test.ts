import pgdb from '../../../../../server/db/PGDB.js';
import { TestRunner } from '../../../../../common/TestRunner.js';
import { simpleReadWriteTest } from './simpleReadWriteTest.test.js';
import { readdirTest } from './readdirTest.test.js';
import { readdirByOwnerTest } from './readdirByOwnerTest.test.js';
import { getMaxOrdinalTest } from './getMaxOrdinalTest.test.js';
import { readFileTest } from './readFileTest.test.js';
import { writeTextFileTest } from './writeTextFileTest.test.js';
import { writeBinaryFileTest } from './writeBinaryFileTest.test.js';
import { existsTest } from './existsTest.test.js';
import { getNodeByNameTest } from './getNodeByNameTest.test.js';
import { statTest } from './statTest.test.js';
import { unlinkTest } from './unlinkTest.test.js';
import { childrenExistTest } from './childrenExistTest.test.js';
import { mkdirRmdirTest } from './mkdirRmdirTest.test.js';
import { ensurePathAndRenameTest } from './ensurePathAndRenameTest.test.js';
import { setPublicTest } from './setPublicTest.test.js';
import { checkAuthTest } from './checkAuthTest.test.js';
import { getNodeByUuidTest } from './getNodeByUuidTest.test.js';
import { searchTextTest } from './searchTextTest.test.js';

import { normalizePathTest } from './normalizePathTest.js';
import { joinPathTest } from './joinPathTest.js';
import { existsTest2 } from './existsTest2.js';
import { readdirExTest } from './readdirExTest.js';
import { childrenExistTest2 } from './childrenExistTest2.js';
import { renameTest } from './renameTest.js';
import { statTest2 } from './statTest2.js';
import { shiftOrdinalsDownTest } from './shiftOrdinalsDownTest.js';
import { writeFileExTest } from './writeFileExTest.js';
import { writeFileAndReadFileTest } from './writeFileAndReadFileTest.js';
import { rmTest } from './rmTest.js';
import { unlinkTest2 } from './unlinkTest2.js';
import { readdirTest2 } from './readdirTest2.js';
import { getItemByIDTest } from './getItemByIDTest.js';
import { setOrdinalTest } from './setOrdinalTest.js';
import { moveUpOrDownTest } from './moveUpOrDownTest.js';


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
        
        // Run the check_auth test using the test runner
        await testRunner.run("checkAuthTest", () => checkAuthTest(owner_id), true);
        
        // Run the get_node_by_uuid test using the test runner
        await testRunner.run("getNodeByUuidTest", () => getNodeByUuidTest(owner_id), true);
        
        // Run the search_text test using the test runner
        await testRunner.run("searchTextTest", () => searchTextTest(owner_id), true);
        
        // Test the normalizePath method
        await testRunner.run("normalizePathTest", () => normalizePathTest(), true);
        
        // Test the joinPath method
        await testRunner.run("joinPathTest", () => joinPathTest(), true);
        
        // Test the exists method
        await testRunner.run("existsTest", () => existsTest2(), true);
                
        // Test the readdirEx method
        await testRunner.run("readdirExTest", () => readdirExTest(owner_id), true);
        
        // Test the childrenExist method
        await testRunner.run("childrenExistTest", () => childrenExistTest2(owner_id), true);
        
        // Test the rename method
        await testRunner.run("renameTest", () => renameTest(owner_id), true);
        
        // Test the stat method
        await testRunner.run("statTest2", () => statTest2(), true);
        
        // Test the shiftOrdinalsDown method
        await testRunner.run("shiftOrdinalsDownTest", () => shiftOrdinalsDownTest(owner_id), true);
        
        // Test the writeFileEx method with ordinals
        await testRunner.run("writeFileExTest", () => writeFileExTest(owner_id), true);
        
        // Test the writeFile and readFile methods
        await testRunner.run("writeFileAndReadFileTest", () => writeFileAndReadFileTest(owner_id), true);
        
        // Test the rm method
        await testRunner.run("rmTest", () => rmTest(owner_id), true);
        
        // Test the unlink method
        await testRunner.run("unlinkTest", () => unlinkTest2(owner_id), true);
        
        // Test the readdir method
        await testRunner.run("readdirTest", () => readdirTest2(owner_id), true);
        
        // Test the getItemByID method
        await testRunner.run("getItemByIDTest", () => getItemByIDTest(owner_id), true);
        
        // Test the setOrdinal method
        await testRunner.run("setOrdinalTest", () => setOrdinalTest(owner_id), true);
        
        // Test the moveUpOrDown functionality (ordinal swapping)
        await testRunner.run("moveUpOrDownTest", () => moveUpOrDownTest(owner_id), true);

        console.log("✅ VFS2 test suite passed");
    } catch {
        console.error("❌ VFS2 test suite failed");
    }
    finally {
        testRunner.report();
    }
}

