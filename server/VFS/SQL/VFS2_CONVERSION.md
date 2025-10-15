# Converting from VFS to VFS2

NOTE: This markdown file is created specifically for use by our AI Agent to help us create something we will call VFS2. We're going to be giving the agent an overview of what we're wanting to accomplish (section below) and then submitting steps one by one to help the AI Agent work on the code for us, to create VFS2 one step at a time, as will be listed in the implementation steps below. 

## Overview

This markdown file will contain the AI prompts, and instructions related to converting our `VFS` file system implementation to a newer version of the file system implementation which we will call `VFS2`. the original VFS was developed to a table structure that was specifically designed to be as compatible with standard file systems (such as the Linux file system), and so the ordinal ordering of the files and folders was originally done by an ordinal prefix (like "0123_") added to all files and folders to control the ordering. however we have now dropped the requirement for using a standard file system compatible approach, and so we can do things more efficiently now in VFS2 in several areas but most notably in the way in which we encode the ordinals. remember the ordinals are simply the way that we control the positional ordering of the files and folders, which is something that file systems do not natively support , but that we support in our VFS/VFS2.

Currently the VFS implementation (at least for the postgres SQL functions and postgres tables) we have those SQL commands defined in `plugins/docs/server/VFS/SQL/functions.sql` and `plugins/docs/server/VFS/SQL/schema.sql`. We'll create our new VFS2 SQL implementation in `plugins/docs/VFS2/SQL`.

To save tokens, as you do each Step below, please just respond with "done." when you've completed your work, so we can save on token use. You don't need to explain what you've done, just do it.

## VFS2 Implementation Steps

### Step 1

Please create the new `schema.sql` for the VFS2 implementation, using the original VFS as your exact model to follow except that the following two things will be different now for VFS2:

1) in the table names and other SQL artifacts wherever we're using 'vfs' in the naming will now be using 'vfs2' because our database itself will actually be having the old tables and the new tables side by side so we must use the '2' suffix to make sure we don't have any naming collisions .

2) let's go ahead and make sure there is an ordinal column in the file system table that is an integer type and has an index on it as appropriate in order to support the ability to order by that integer efficiently in our queries, because as stated above the ordinal controls the ordering of the files in our virtual file system . this is a key difference between VFS and VFS2. VFS2 uses an ordinal column in the actual database table.

### Step 2

You'll notice in the file named `plugins/docs/server/VFS/test/vfs.test.ts` we have all of our existing testing for VFS. we of course cannot replicate all of those test cases right now , and I'm not asking you to , but what you can do for now is create a test file named `plugins/docs/server/VFS2/test/vfs2.test.ts` and using the appropriate similar approaches to what we have in the VFS version, I would like for you to create just one single unit test following that same pattern , which will simply verify that we can write a record to our new VFS2 table and read it back. for now don't try to wire up this test case to actually run because you won't know how to make it run, I would just like for you to focus on creating the actual test file with this implementation in it, and we'll worry about getting the test to run in the next step . 

### Steps 3 thru 19

Note: Steps 3 thru 19 have been removed from this markdown, to save space (and AI tokens), but what those steps accomplished was to create the vfs2 version of `functions.sql` using the vfs version of `functions.sql` as the example, and all that work is comkplete. The `functions.sql` for vfs2 is fully completed with Unit Tests for each as well.

### Step 20

The original VFS TypeScript implementation is in file `plugins/docs/server/VFS/VFS.ts` and so please create the vfs2 version of this file in `plugins/docs/server/VFS/VFS2.ts`, but don't add any functions into the class yet, and don't try to use the class anywhere. We're going to be carefully adding methods to it one by one, under my guidance. For now just create the new vfs2 file with proper imports.

### Step 21

I've created the file named `vfs2-svc.test.ts` (which I have a special way of executing that you don't need to worry about, because it's essentially done by me starting up the docker stack manually to cause tests to execute). Please create the implementation of 'normalizePath' method, in `VFS2.ts` and then create a unit test for that method inside `vfs2-svc.test.ts`. To understand how our test framework works, you can refer to `vfs2.test.ts` as the example to follow. When you're done creating this new method and it's unit test, please don't desribe what you've done or even try to run it yourself. Just say 'done.' and I'll know how to go test it myself.

### Step 22

Next, smilar to Step 21, add implementation and unit test for 'joinPath'.

### Step 23

Continuing again with 'VFS2.ts', add implementation and unit test for 'exists'.

### Step 24

Continuing again with 'VFS2.ts', add implementation and unit test for 'checkFileAccess'.

### Step 25

Continuing again with 'VFS2.ts', add implementation and unit test for 'readdirEx'.

### Step 26

Continuing again with 'VFS2.ts', add implementation and unit test for 'childrenExist'.

### Step 27

Continuing again with 'VFS2.ts', add implementation and unit test for 'rename' method.

### Step 28

Continuing again with 'VFS2.ts', add implementation and unit test for 'stat' method.

