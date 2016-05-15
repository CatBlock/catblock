#!/usr/bin/python

"""
Prepare a Firefox and Edge release versions of CatBlock
This script is compatible with Python v2.7.x

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import shutil # Provides folders functions
import argparse # Provides functions for parsing arguments

# Parse passed arguments
parser = argparse.ArgumentParser(description="This script generates Firefox and Edge versions of CatBlock")
parser.add_argument("-b", "--browser", help="Browser name", required=True)
args = parser.parse_args()

os.chdir("..") # Move CWD to the root of repo

origcwd = os.getcwd() # Save CWD for later use

os.chdir("..") # Move CWD to the top of repo

# Prepare a Firefox release
if args.browser == "firefox":

    print "Preparing CatBlock for Firefox release..."

    # Keys, which should NOT be deleted
    used = ["name", "version", "description", "content_scripts", "permissions", "manifest_version",
        "web_accessible_resources", "background", "browser_action", "default_locale", "icons"]

    # Set, which is mandatory in Firefox
    FF = {
        "gecko": {
            "id": "adblockwithcatblock@catblock.tk",
            "strict_min_version": "48"
        }
    }

    # Opens the CatBlock manifest file for read-only
    with open(origcwd + "/manifest.json", "rU") as chrome_manifest:
        if os.path.exists(os.getcwd() + "/catblock_ff"): # If /catblock_ff folder does exist, delete it
            shutil.rmtree(os.getcwd() + "/catblock_ff")

        # Copy the content of the original folder into /catblock_ff
        shutil.copytree(origcwd, os.getcwd() + "/catblock_ff", ignore=shutil.ignore_patterns(".git*"))
        os.chdir(os.getcwd() + "/catblock_ff")
        with open("manifest.json", "w") as ff_manifest:
            keys = json.load(chrome_manifest) # Creates a dict of all messages in the AdBlock file
            for key, value in keys.items():
                if key not in used:
                    print "Deleting key: %s" % key
                    del keys[key] # Delete keys, which shouldn't be included in FF manifest file
            keys.update({ "applications": FF }) # Update FF manifest file with FF specific key
            ff_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(',', ':'))) # Create FF manifest in JSON format
            print "CatBlock for Firefox has been built!"

elif args.browser == "edge":

    print "Preparing CatBlock for Edge release..."

    # Copy the content of the original folder into "/catblock_edge/catblock"
    if os.path.exists(os.getcwd() + "/catblock_edge"): # If /catblock_edge folder doesn't exist, create it
        shutil.rmtree(os.getcwd() + "/catblock_edge")

    shutil.copytree(origcwd, os.getcwd() + "/catblock_edge/catblock", ignore=shutil.ignore_patterns(".git*"))

    # Copy instructions file and setup file into "/catblock_edge" folder
    shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/instructions.txt", os.getcwd() + "/catblock_edge/")
    shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/Setup.cmd", os.getcwd() + "/catblock_edge/")

    print "CatBlock for Edge has been built!"

else:
    print "Only Edge and Firefox browsers are supported (-b edge OR -b firefox)"
