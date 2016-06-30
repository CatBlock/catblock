#!/usr/bin/python

"""
Prepare a release versions of CatBlock for Chrome, Opera, Firefox and Edge
This script is compatible with Python v3.x

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import shutil # Provides folders functions
import argparse # Provides functions for parsing arguments

# Selenium testing
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
import time

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

    print("Preparing CatBlock for Firefox release...")

    # Keys in manifest.json file, which should NOT be deleted
    used = ["name", "version", "description", "content_scripts", "permissions", "manifest_version",
        "web_accessible_resources", "background", "browser_action", "default_locale", "icons", "web_accessible_resources"]

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

        # Copy the content of the original folder into /catblock_firefox and ignore hidden files, builds and tools folders
        shutil.copytree(os.getcwd(), "catblock_firefox", ignore=shutil.ignore_patterns(".*", "builds", "tools"))

        # Move to the /catblock_firefox directory
        os.chdir("catblock_firefox")

        # Remove keys from manifest, which are not supported yet
        with open("manifest.json", "w") as ff_manifest:
            keys = json.load(chrome_manifest) # Creates a dict of all messages in the AdBlock file
            ff_keys = keys.copy()
            for key in keys:
                if key not in used:
                    print("Deleting key: %s" % key)
                    del ff_keys[key] # Delete keys, which shouldn't be included in FF manifest file

            # Update FF manifest file with FF specific key
            ff_keys.update({ "applications": FF })

            # Create FF manifest in JSON format
            ff_manifest.write(json.dumps(ff_keys, sort_keys=True, indent=2, separators=(',', ':')))

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

        print("CatBlock for Firefox has been built!")

elif args.browser == "edge":

    print("Preparing CatBlock for Edge release...")

    # If /catblock_edge folder does exist, remove it
    if os.path.exists("catblock_edge"):
        shutil.rmtree("catblock_edge")

    # Copy the content of the original folder into /catblock_edge/catblock and ignore hidden files and builds folder
    shutil.copytree(os.getcwd(), "catblock_edge/catblock", ignore=shutil.ignore_patterns(".*", "builds"))

    # Copy instructions file and setup file into "/catblock_edge" folder
    shutil.move("catblock_edge/catblock/tools/instructions.txt", "catblock_edge")
    shutil.move("catblock_edge/catblock/tools/Setup.cmd", "catblock_edge")

    shutil.make_archive("catblock-edge", "zip", "catblock_edge")

    shutil.move("catblock-edge.zip", "builds/catblock-edge.zip")

    shutil.rmtree("catblock_edge")

    print("CatBlock for Edge has been built!")

elif args.browser == "chrome":

    print("Preparing CatBlock for Chrome release...")

    # If /catblock_chrome folder does exist, remove it
    if os.path.exists("catblock_chrome"):
        shutil.rmtree("catblock_chrome")

    # Copy the content of the original folder into /catblock_chrome and ignore hidden files, builds and tools folders
    #shutil.copytree(os.getcwd(), "catblock_chrome", ignore=shutil.ignore_patterns(".*", "builds", "tools"))
    shutil.copytree(os.getcwd(), "catblock_chrome", ignore=shutil.ignore_patterns(".*", "builds"))

    shutil.make_archive("catblock-chrome", "zip", "catblock_chrome")

    # Selenium testing (beta)
    chop = webdriver.ChromeOptions()
    chop.add_extension('catblock-chrome.zip')
    chop = chop.to_capabilities()

    chop['os'] = 'OS X'
    chop['os_version'] = 'El Capitan'
    chop['browser'] = 'Chrome'
    chop['browserstack.debug'] = 'true'

    print(os.environ['BS_USERNAME'])
    driver = webdriver.Remote(
        command_executor='http://'+os.environ['BS_USERNAME']+':'+os.environ['BS_API']+'@hub.browserstack.com:80/wd/hub',
        desired_capabilities=chop)

    driver.get('chrome-extension://pgojeaneabfggifhijmhbomgidllkfhp/tools/tests/test.html')

    time.sleep(2)

    failure = driver.execute_script('return failure')

    print(failure)

    if failure == True:
        print(driver.execute_script('return messages'))

    driver.quit()

    if failure == True:
        sys.exit(1)
    # End of Selenium testing (beta)


    # Rename to the Chrome compatible .crx file
    if args.extension == "y":
        os.rename("catblock-chrome.zip", "catblock-chrome.crx")

    if os.path.isfile("catblock-chrome.zip"):
        shutil.move("catblock-chrome.zip", "builds/catblock-chrome.zip")
    else:
        shutil.move("catblock-chrome.crx", "builds/catblock-chrome.crx")

    shutil.rmtree("catblock_chrome")

    print("CatBlock for Chrome has been built!")

elif args.browser == "opera":
    # TODO: Add support for removing "minimum_chrome_version" key from manifest.json
    # and add support for defining "minimum_opera_version" key in manifest.json

    print("Preparing CatBlock for Opera release...")

    # If /catblock_chrome folder does exist, remove it
    if os.path.exists("catblock_opera"):
        shutil.rmtree("catblock_opera")

    # Copy the content of the original folder into /catblock_opera and ignore hidden files, builds and tools folders
    shutil.copytree(os.getcwd(), "catblock_opera", ignore=shutil.ignore_patterns(".*", "builds", "tools"))

    shutil.make_archive("catblock-opera", "zip", "catblock_opera")

    # Rename to the Opera compatible .nex file
    if args.extension == "y":
        os.rename("catblock-opera.zip", "catblock-opera.nex")

    if os.path.isfile("catblock-opera.zip"):
        shutil.move("catblock-opera.zip", "builds/catblock-opera.zip")
    else:
        shutil.move("catblock-opera.nex", "builds/catblock-opera.nex")

    shutil.rmtree("catblock_opera")

    print("CatBlock for Opera has been built!")
else:
    print("You have selected an unsupported browser. Please, try again.")
