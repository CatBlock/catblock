"""
This script generates a release versions of CatBlock for different platforms
and also an unpacked development environment

Compatible with Python v3.x

Author: Tomas Taro
License: GNU GPLv3
"""

def main():
    import json # Provides JSON-related functions
    import os # Provides file-system functions
    import sys
    import shutil # Provides folders functions
    import argparse # Provides functions for parsing arguments

    # Parse passed arguments
    parser = argparse.ArgumentParser(description="This script generates CatBlock for a specified browser")
    parser.add_argument("-b", "--browser", help="What browser do you want to build an extension for?", required=True)
    parser.add_argument("-ext", "--extension", help="Generate an extension package for a particular browser?", required=False)
    parser.add_argument("-devenv", help="Generate an unpacked development environment?", required=False)
    args = parser.parse_args()

    # When nothing has been defined except the target, print an exception and return
    if args.extension == None and args.devenv == None:
        print("You must specify, whether to create an unpacked development environment or to generate an extension package")
        sys.exit(1)

    # Remove .DS_Store files
    os.system("find . -name '*.DS_Store' -type f -delete")

    # If /builds directory doesn't exist, create it
    if not os.path.exists("builds"):
        os.makedirs("builds")

    # Prepare manifest.json file depending on the browser
    def prepareManifestFile():
        browserData = {
            "firefox": {
                "path": "catblock_firefox/manifest.json",
                "key": {
                    "applications": {
                        "gecko": {
                            "id": "catblock@catblock.tk",
                            "strict_min_version": "48.0"
                        }
                    }
                }
            },
            "edge": {
                "path": "catblock_edge/catblock/manifest.json",
                "key": {
                    "minimum_edge_version": "38.14342.1000.0"
                }
            },
            "chrome": {
                "path": "catblock_chrome/manifest.json",
                "key": {
                    "minimum_chrome_version": "49"
                }
            },
            "opera": {
                "path": "catblock_opera/manifest.json",
                "key": {
                    "minimum_opera_version": "35"
                }
            }
        }

        # Apply platform-specific changes
        with open(browserData[args.browser]["path"], "r+") as browser_manifest:
            keys = json.load(browser_manifest) # Creates a dict of all messages in the AdBlock file

            # Update manifest file with browser-specific key
            keys.update(browserData[args.browser]["key"])

            # Needed for determining an extension ID used for automated tests via BrowserStack
            if args.browser == "chrome" and os.environ.get("TRAVIS") != None:
                keys.update({ "key": "emghbjjpdkocbmeibmkblchiognbjiji" })
            elif args.browser == "firefox":
                keys.pop("author", None)
                keys.pop("optional_permissions", None)
                keys.pop("options_page", None)
                keys.pop("incognito", None)

            # Delete the current content of the manifest
            browser_manifest.seek(0)
            browser_manifest.truncate()

            # Re-create the manifest but with added browser-sepcific key
            browser_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(',', ':')))

            browser_manifest.close()

    # Prepare a Firefox release
    if args.browser == "firefox":

        print("Generating CatBlock for Firefox...")

        # If /catblock_firefox folder exists, delete it
        if os.path.exists("catblock_firefox"):
            shutil.rmtree("catblock_firefox")

        # Copy the content of the original folder into /catblock_firefox and
        # ignore hidden files, builds and tools folders
        shutil.copytree(os.getcwd(), "catblock_firefox", ignore=shutil.ignore_patterns(".*", "builds", "tools"))

        # Prepare manifest.json file
        prepareManifestFile()

        # Generate a packed extension
        if args.extension != None:
            shutil.make_archive("catblock-firefox", "zip", "catblock_firefox")

            # Rename to the Firefox compatible .xpi file
            if args.extension == "browser":
                os.rename("catblock-firefox.zip", "catblock-firefox.xpi")
                shutil.move("catblock-firefox.xpi", "builds/catblock-firefox.xpi")
            else:
                shutil.move("catblock-firefox.zip", "builds/catblock-firefox.zip")

        # When an unpacked development environment should not be created, remove the folder
        if args.devenv == None:
            shutil.rmtree("catblock_firefox")

        print("Done!")

    elif args.browser == "edge":

        print("Generating CatBlock for Edge...")

        # If /catblock_edge folder does exist, remove it
        if os.path.exists("catblock_edge"):
            shutil.rmtree("catblock_edge")

        # Copy the content of the original folder into /catblock_edge/catblock and ignore hidden files and builds folder
        shutil.copytree(os.getcwd(), "catblock_edge/catblock", ignore=shutil.ignore_patterns(".*", "builds"))

        # Copy instructions file and setup file into "/catblock_edge" folder
        shutil.move("catblock_edge/catblock/tools/instructions.txt", "catblock_edge")
        shutil.move("catblock_edge/catblock/tools/Setup.cmd", "catblock_edge")

        # Prepare manifest.json file
        prepareManifestFile()

        # Edge doesn't support a special suffix of an extension,
        # hence we ignore -ext argument
        # Generate a packed extension
        if args.extension != None:
            shutil.make_archive("catblock-edge", "zip", "catblock_edge")
            shutil.move("catblock-edge.zip", "builds/catblock-edge.zip")

        # When an unpacked development environment should not be created, remove the folder
        if args.devenv == None:
            shutil.rmtree("catblock_edge")

        print("Done!")

    elif args.browser == "chrome":

        print("Generating CatBlock for Chrome...")

        # If /catblock_chrome folder does exist, remove it
        if os.path.exists("catblock_chrome"):
            shutil.rmtree("catblock_chrome")

        # Copy the content of the original folder into /catblock_chrome and ignore hidden files, builds and tools folders
        shutil.copytree(os.getcwd(), "catblock_chrome", ignore=shutil.ignore_patterns(".*", "builds"))

        # Prepare manifest.json file
        prepareManifestFile()

        # Selenium testing - enabled only on Travis-CI
        if os.environ.get("TRAVIS") != None:
            from selenium import webdriver
            from selenium.webdriver.common.keys import Keys
            from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
            import time

            shutil.make_archive("catblock-chrome", "zip", "catblock_chrome")

            chop = webdriver.ChromeOptions()
            chop.add_extension("catblock-chrome.zip")
            chop = chop.to_capabilities()

            chop["os"] = "OS X"
            chop["os_version"] = "Sierra"
            chop["browser"] = "Chrome"
            chop["browserstack.debug"] = "true"

            driver = webdriver.Remote(
                command_executor="http://"+os.environ["BS_USERNAME"]+":"+os.environ["BS_API"]+"@hub.browserstack.com:80/wd/hub",
            desired_capabilities=chop)

            driver.get("chrome-extension://pgojeaneabfggifhijmhbomgidllkfhp/tools/tests/test.html")

            time.sleep(2)

            failure = driver.execute_script("return failure")

            if failure == True:
                print(driver.execute_script("return messages"))

            driver.quit()

            if failure == True:
                sys.exit(1)
        # End of Selenium testing

        # Generate a packed extension
        if args.extension != None:
            # In Travis, catblock-chrome.zip has already been created
            if os.environ.get("TRAVIS") == None:
                shutil.make_archive("catblock-chrome", "zip", "catblock_chrome")

            # Rename to the Chrome's compatible .crx file
            if args.extension == "browser":
                os.rename("catblock-chrome.zip", "catblock-chrome.crx")
                shutil.move("catblock-chrome.crx", "builds/catblock-chrome.crx")
            else:
                shutil.move("catblock-chrome.zip", "builds/catblock-chrome.zip")

        # When an unpacked development environment should not be created, remove the folder
        if args.devenv == None:
            shutil.rmtree("catblock_chrome")

        print("Done!")

    elif args.browser == "opera":

        print("Generating CatBlock for Opera...")

        # If /catblock_opera folder does exist, remove it
        if os.path.exists("catblock_opera"):
            shutil.rmtree("catblock_opera")

        # Copy the content of the original folder into /catblock_opera and ignore hidden files, builds and tools folders
        shutil.copytree(os.getcwd(), "catblock_opera", ignore=shutil.ignore_patterns(".*", "builds", "tools"))

        # Prepare manifest.json file
        prepareManifestFile()

        # Generate a packed extension
        if args.extension != None:
            shutil.make_archive("catblock-opera", "zip", "catblock_opera")

            # Rename to the Opera's compatible .nex file
            if args.extension == "browser":
                os.rename("catblock-opera.zip", "catblock-opera.nex")
                shutil.move("catblock-opera.nex", "builds/catblock-opera.nex")
            else:
                shutil.move("catblock-opera.zip", "builds/catblock-opera.zip")

        # When an unpacked development environment should not be created, remove the folder
        if args.devenv == None:
            shutil.rmtree("catblock_opera")

        print("Done!")

    else:
        print("You have selected an unsupported browser. Please, try again.")

# Execute this script only, if it hasn't been imported as a module
if __name__ == "__main__":
    main()