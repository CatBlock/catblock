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

    # Keys in manifest.json file, which should NOT be deleted
    used = ["name", "version", "description", "content_scripts", "permissions", "manifest_version",
        "web_accessible_resources", "background", "browser_action", "default_locale", "icons"]

    # Set, which is mandatory in Firefox
    FF = {
        "gecko": {
            "id": "catblock@catblock.tk",
            "strict_min_version": "48.*"
        }
    }

    # Opens the CatBlock manifest file for read-only
    with open(origcwd + "/manifest.json", "rU") as chrome_manifest:
        # If /catblock_ff folder exists, delete it
        if os.path.exists(os.getcwd() + "/catblock_ff"):
            shutil.rmtree(os.getcwd() + "/catblock_ff")

        # Copy the content of the original folder into /catblock_ff and ignore GitHub's hidden files
        shutil.copytree(origcwd, os.getcwd() + "/catblock_ff", ignore=shutil.ignore_patterns(".git*"))

        # Move to the /catblock_ff directory
        os.chdir(os.getcwd() + "/catblock_ff")

        # Remove tools folder from /catblock_ff folder
        shutil.rmtree(os.getcwd() + "/tools")

        # Remove keys from manifest, which are not supported yet
        with open("manifest.json", "w") as ff_manifest:
            keys = json.load(chrome_manifest) # Creates a dict of all messages in the AdBlock file
            for key, value in keys.items():
                if key not in used:
                    print "Deleting key: %s" % key
                    del keys[key] # Delete keys, which shouldn't be included in FF manifest file

            # Update FF manifest file with FF specific key
            keys.update({ "applications": FF })

            # Create FF manifest in JSON format
            ff_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(',', ':')))

        # Create a .zip file
        shutil.make_archive("catblock", "zip", os.getcwd())

        # Rename to the Firefox compatible .xpi file
        os.rename("catblock.zip", "catblock.xpi")

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
