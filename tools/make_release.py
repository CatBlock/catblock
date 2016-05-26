#!/usr/bin/python

"""
Prepare a release versions of CatBlock for Chrome, Opera, Firefox and Edge
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
parser.add_argument("-b", "--browser", help="Name of the browser, which should we generate an extension for", required=True)
parser.add_argument("-ext", "--extension", help="Generate an extension package for a particular browser?", required=False)
args = parser.parse_args()

# Remove .DS_Store files
os.system("find . -name '*.DS_Store' -type f -delete")

# If /builds doesn't exist, create it
if not os.path.exists("builds"):
    os.makedirs("builds")

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
    with open("manifest.json", "rU") as chrome_manifest:
        # If /catblock_firefox folder exists, delete it
        if os.path.exists("catblock_firefox"):
            shutil.rmtree("catblock_firefox")

        # Copy the content of the original folder into /catblock_firefox and ignore hidden files
        shutil.copytree(os.getcwd(), "catblock_firefox", ignore=shutil.ignore_patterns(".*"))

        # Move to the /catblock_firefox directory
        os.chdir("catblock_firefox")

        # Remove tools folder from /catblock_firefox folder
        shutil.rmtree("tools")

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

        os.chdir("..")

        # Create a .zip file
        shutil.make_archive("catblock-firefox", "zip", "catblock_firefox")

        # Rename to the Firefox compatible .xpi file
        if args.extension == "y":
            os.rename("catblock-firefox.zip", "catblock-firefox.xpi")

        if os.path.isfile("catblock-firefox.zip"):
            shutil.move("catblock-firefox.zip", "builds/catblock-firefox.zip")
        else:
            shutil.move("catblock-firefox.xpi", "builds/catblock-firefox.xpi")

        shutil.rmtree("catblock_firefox")

        print "CatBlock for Firefox has been built!"

elif args.browser == "edge":

    print "Preparing CatBlock for Edge release..."

    # If /catblock_edge folder does exist, remove it
    if os.path.exists("catblock_edge"):
        shutil.rmtree("catblock_edge")

    # Copy the content of the original folder into "/catblock_edge/catblock"
    shutil.copytree(os.getcwd(), "catblock_edge/catblock", ignore=shutil.ignore_patterns(".*"))

    # Copy instructions file and setup file into "/catblock_edge" folder
    shutil.move("catblock_edge/catblock/tools/instructions.txt", "catblock_edge")
    shutil.move("catblock_edge/catblock/tools/Setup.cmd", "catblock_edge")

    shutil.make_archive("catblock-edge", "zip", "catblock_edge")

    shutil.move("catblock-edge.zip", "builds/catblock-edge.zip")

    shutil.rmtree("catblock_edge")

    print "CatBlock for Edge has been built!"

elif args.browser == "chrome":

    print "Preparing CatBlock for Chrome release..."

    # If /catblock_chrome folder does exist, remove it
    if os.path.exists("catblock_chrome"):
        shutil.rmtree("catblock_chrome")

    # Copy the content of the original folder into "/catblock_chrome"
    shutil.copytree(os.getcwd(), "catblock_chrome", ignore=shutil.ignore_patterns(".*"))

    shutil.make_archive("catblock-chrome", "zip", "catblock_chrome")

    # Rename to the Chrome compatible .crx file
    if args.extension == "y":
        os.rename("catblock-chrome.zip", "catblock-chrome.crx")

    if os.path.isfile("catblock-chrome.zip"):
        shutil.move("catblock-chrome.zip", "builds/catblock-chrome.zip")
    else:
        shutil.move("catblock-chrome.crx", "builds/catblock-chrome.crx")

    shutil.rmtree("catblock_chrome")

    print "CatBlock for Chrome has been built!"

elif args.browser == "opera":
    # TODO: Add support for removing "minimum_chrome_version" key from manifest.json
    # and add support for defining "minimum_opera_version" key in manifest.json

    print "Preparing CatBlock for Opera release..."

    # If /catblock_chrome folder does exist, remove it
    if os.path.exists("catblock_opera"):
        shutil.rmtree("catblock_opera")

    # Copy the content of the original folder into "/catblock_opera"
    shutil.copytree(os.getcwd(), "catblock_opera", ignore=shutil.ignore_patterns(".*"))

    shutil.make_archive("catblock-opera", "zip", "catblock_opera")

    # Rename to the Opera compatible .nex file
    if args.extension == "y":
        os.rename("catblock-opera.zip", "catblock-opera.nex")

    if os.path.isfile("catblock-opera.zip"):
        shutil.move("catblock-opera.zip", "builds/catblock-opera.zip")
    else:
        shutil.move("catblock-opera.nex", "builds/catblock-opera.nex")

    shutil.rmtree("catblock_opera")

    print "CatBlock for Opera has been built!"
else:
    print "You have selected an unsupported browser. Please, try again."
