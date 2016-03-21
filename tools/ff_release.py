#!/usr/bin/python
"""
Prepare a Firefox release version of CatBlock
This script is compatible with Python v2.7.x

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import sys
import shutil
from distutils.dir_util import copy_tree # Provides function for copying trees

# Check, if we have got admin rights on OS X and Linux
if sys.platform == "linux2" or sys.platform == "darwin":
    if os.getuid() != 0:
        print "This script needs to be running with sudo privileges."
        sys.exit(1)

print "Preparing CatBlock for Firefox release..."

os.chdir("..") # Move CWD to the root of repo

origcwd = os.getcwd() # Save CWD for later use

os.chdir("..") # Move CWD to the top of repo

# Keys, which should NOT be deleted
used = ["name", "version", "description", "content_scripts", "permissions", "manifest_version",
        "web_accessible_resources", "background", "browser_action", "default_locale", "icons"]

# Set, which is mandatory in Firefox
FF = {
    "gecko": {
        "id": "adblockwithcatblock@catblock.org",
        "strict_min_version": "46"
    }
}

with open(origcwd + "/manifest.json", "rU") as chrome_manifest: # Opens the CatBlock manifest file for read-only
    if not os.path.exists(os.getcwd() + "/catblock_ff"): # If /catblock_ff folder doesn't exist, create it
        os.makedirs(os.getcwd() + "/catblock_ff")
    copy_tree(origcwd, os.getcwd() + "/catblock_ff") # Copy the content of the original folder into /catblock_ff
    os.chdir(os.getcwd() + "/catblock_ff")
    with open("manifest.json", "w") as ff_manifest:
        keys = json.load(chrome_manifest) # Creates a dict of all messages in the AdBlock file
        for key, value in keys.items():
            if key not in used:
                print "Deleting key: %s" % key
                del keys[key] # Delete keys, which shouldn't be included in FF manifest file
        keys.update({ "applications": FF }) # Update FF manifest file with FF specific key
        ff_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(',', ':'))) # Create FF manifest in JSON format
        shutil.rmtree(os.getcwd() + "/.git", ignore_errors=True)
        print "CatBlock for Firefox has been built!"
