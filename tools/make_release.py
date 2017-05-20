#!/usr/bin/env python3

"""
This script generates a release versions of CatBlock for different platforms
and also an unpacked development environment

Compatible with Python v3.x only

Author: Tomáš Taro
License: GNU GPLv3
"""

def main():
    import json # Provides JSON-related functions
    import os # Provides file-system functions
    import sys # Provides system functions
    import shutil # Provides folders functions
    import argparse # Provides functions for parsing arguments

    # Parse passed arguments
    parser = argparse.ArgumentParser(description="This script generates CatBlock extension for different platforms and/or an unpacked development environment.")
    parser.add_argument("-b", "--browser", help="What browser do you want to build an extension for?", required=True)
    parser.add_argument("-ext", "--extension", help="Generate browser-specific extension package?", required=False)
    parser.add_argument("-devenv", help="Generate an unpacked development environment?", action="store_true")
    parser.add_argument("--updatelangs", help="If enabled, language files will be updated", action="store_true")
    args = parser.parse_args()

    # Function intended for printing bold strings
    def printBold(string):
        print("\033[1m" + string + "\033[0m")

    # An invalid option was selected, exit the script
    if args.browser != "firefox" and args.browser != "chrome" and args.browser != "opera" and args.browser != "edge" and args.browser != "all":
        printBold("You have selected an unsupported browser. Please, try again.")
        sys.exit(1)

    # When neither -ext nor -devenv has been defined, print an exception and exit the script
    if args.extension == None and args.devenv == False:
        printBold("You must specify, whether to create an unpacked development environment or to generate an extension package.")
        sys.exit(1)

    # Remove .DS_Store files
    os.system("find . -name '*.DS_Store' -type f -delete")

    # Update AB & CB language files
    if args.updatelangs == True:
        os.system("tools/update_i18n.py")

    # Remove already unused language files,
    # which have been merged into main language files
    if os.path.exists("catblock/_locales"):
        shutil.rmtree("catblock/_locales")

    # If /builds directory doesn't exist, create it
    if not os.path.exists("builds"):
        os.makedirs("builds")

    # Prepare manifest.json file depending on the browser
    def prepareManifestFile(browser):
        browserData = {
            "firefox": {
                "path": "catblock_firefox/manifest.json",
                "key": {
                    "applications": {
                        "gecko": {
                            "id": "catblock@catblock.tk",
                            "strict_min_version": "50.0"
                        }
                    },
                    "options_ui": {
                        "page": "options/index.html",
                        "open_in_tab": True
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
                    "minimum_chrome_version": "58"
                }
            },
            "opera": {
                "path": "catblock_opera/manifest.json",
                "key": {
                    "minimum_opera_version": "45"
                }
            }
        }

        # Apply platform-specific changes
        with open(browserData[browser]["path"], "r+") as browser_manifest:
            keys = json.load(browser_manifest) # Creates a dict of all messages in the AdBlock file

            # Update manifest file with browser-specific key
            keys.update(browserData[browser]["key"])

            # Needed for determining an extension ID used for automated tests via BrowserStack
            if browser == "chrome" and os.environ.get("TRAVIS") != None:
                keys.update({ "key": os.environ.get("EXTENSION_KEY") })
                # Update content security policy in order to correctly run unit tests
                keys.update({ "content_security_policy": keys["content_security_policy"] + " script-src 'unsafe-eval';" })
            elif browser == "firefox":
                keys.pop("optional_permissions", None)
                keys.pop("options_page", None)
                keys.pop("incognito", None)

            # Delete the current content of the manifest
            browser_manifest.seek(0)
            browser_manifest.truncate()

            # Re-create the manifest but with added browser-sepcific key
            browser_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(",", ": ")))

            browser_manifest.close()

    # End of prepareManifestFile

    # Selenium testing - enabled only on Travis-CI
    def runUnitTests(browser):

        # Currently, we are not running tests for other browsers than Chrome
        if browser != "Chrome":
            return

        # Making catblock-chrome.zip file available in PRs coming from forks
        shutil.make_archive("catblock-chrome", "zip", "catblock_chrome")

        # BS_API key is not exported in build process for forks
        if os.environ.get("BS_API") == None and os.environ.get("TRAVIS") != None:
            return print("  - Running QUnit tests on BrowserStack... N/A in PRs coming from forks.")

        if os.environ.get("TRAVIS") != None:

            from selenium import webdriver
            from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
            import time

            print("  - Running QUnit tests on BrowserStack...", end="")

            chop = webdriver.ChromeOptions()
            chop.add_extension("catblock-chrome.zip")
            chop = chop.to_capabilities()

            chop["os"] = "OS X"
            chop["os_version"] = "Sierra"
            chop["browser"] = "Chrome"
            chop["browserstack.debug"] = "true"

            driver = webdriver.Remote(
                command_executor="http://" + os.environ.get("BS_USERNAME") + ":" + os.environ.get("BS_API") + "@hub.browserstack.com:80/wd/hub",
            desired_capabilities=chop)

            driver.get("chrome-extension://mdcgnhlfpnbeieiiccmebgkfdebafodo/tools/tests/test.html")

            time.sleep(2)

            failure = driver.execute_script("return failure")

            if failure == True:
                print(driver.execute_script("return messages"))

            driver.quit()

            if failure == True:
                print("Failed!")
                sys.exit(1)

            print("Done!")
    # End of runUnitTests

    def generateBrowserPackage(browser):

        browsers = {
            "chrome": {
                "name": "Chrome",
                "path": "catblock_chrome",
                "extname": "catblock-chrome",
                "platformpkgsuffix": ".crx"
            },
            "opera": {
                "name": "Opera",
                "path": "catblock_opera",
                "extname": "catblock-opera",
                "extpkgname": "catblock-opera",
                "platformpkgsuffix": ".nex"
            },
            "firefox": {
                "name": "Firefox",
                "path": "catblock_firefox",
                "extname": "catblock-firefox",
                "platformpkgsuffix": ".xpi"
            },
            "edge": {
                "name": "Edge",
                "path": "catblock_edge",
                "extname": "catblock-edge",
                "platformpkgsuffix": "None"
            }
        }

        BROWSER_NAME = browsers[browser]["name"]
        BROWSER_PATH = browsers[browser]["path"]
        EXTENSION_NAME = browsers[browser]["extname"]
        EXTENSION_ZIP_NAME = EXTENSION_NAME + ".zip"
        EXTENSION_PKG_NAME = EXTENSION_NAME + browsers[browser]["platformpkgsuffix"]

        if BROWSER_NAME == "Chrome" and os.environ.get("TRAVIS") != None:
            print(" > Generating CatBlock for " + BROWSER_NAME + "...")
        else:
            print(" > Generating CatBlock for " + BROWSER_NAME + "...", end="")

        # If /BROWSER_PATH folder exists, delete it
        if os.path.exists(BROWSER_PATH):
            shutil.rmtree(BROWSER_PATH)

        # Copy the content of the original folder into /BROWSER_PATH
        # except of hidden files, builds and tools folders
        if BROWSER_NAME != "Edge":
            if os.environ.get("TRAVIS") != None and BROWSER_NAME == "Chrome":
                shutil.copytree(os.getcwd(), BROWSER_PATH, ignore=shutil.ignore_patterns(".*", "builds"))
            else:
                shutil.copytree(os.getcwd(), BROWSER_PATH, ignore=shutil.ignore_patterns(".*", "builds", "tools"))
        else:
            # Copy the content of the original folder into /catblock_edge/catblock and ignore hidden files and builds folder
            shutil.copytree(os.getcwd(), BROWSER_PATH + "/catblock", ignore=shutil.ignore_patterns(".*", "builds"))

            # Copy instructions file and setup file into "/catblock_edge" folder
            shutil.move(BROWSER_PATH + "/catblock/tools/instructions.txt", BROWSER_PATH)
            shutil.move(BROWSER_PATH + "/catblock/tools/Setup.cmd", BROWSER_PATH)

        # Prepare manifest.json file
        prepareManifestFile(browser)

        # Run our unit tests on BrowserStack
        runUnitTests(BROWSER_NAME)

        # Generate a packed extension (either in .zip or in a browser-specific format)
        if args.extension != None:
            if BROWSER_NAME != "Chrome":
                shutil.make_archive(EXTENSION_NAME, "zip", BROWSER_PATH)
            elif BROWSER_NAME == "Chrome" and os.environ.get("TRAVIS") == None:
                shutil.make_archive(EXTENSION_NAME, "zip", BROWSER_PATH)

            # Rename to the Firefox compatible .xpi file
            # Edge doesn't support a special suffix of an extension,
            # hence we ignore -ext argument
            if args.extension == "browser" and BROWSER_NAME != "Edge":
                os.rename(EXTENSION_ZIP_NAME, EXTENSION_PKG_NAME)
                shutil.move(EXTENSION_PKG_NAME, "builds/" + EXTENSION_PKG_NAME)
            else:
                shutil.move(EXTENSION_ZIP_NAME, "builds/" + EXTENSION_ZIP_NAME)


        # When an unpacked development environment should not be created, remove the folder
        if args.devenv == False:
            shutil.rmtree(BROWSER_PATH)

        if os.environ.get("TRAVIS") == None:
            print("Done!")
        elif os.environ.get("TRAVIS") != None and BROWSER_NAME != "Chrome":
            print("Done!")

    # End of generateBrowserPackage

    # Start the magic!
    if args.devenv == True and args.extension == None:
        if args.browser != "all":
            printBold("Generating development environment for " + args.browser + "...")
        else:
            printBold("Generating development environment for all browsers...")
    elif args.devenv == True and args.extension != None:
        if args.browser != "all":
            printBold("Generating development environment and browser package for " + args.browser + "...")
        else:
            printBold("Generating development environments and browser packages for all browsers...")
    elif args.devenv == False and args.extension != None:
        if args.browser != "all":
            printBold("Generating browser package for " + args.browser + "...")
        else:
            printBold("Generating browser packages for all browsers...")

    if args.browser != "all":
        generateBrowserPackage(args.browser)
    else:
        generateBrowserPackage("chrome")
        generateBrowserPackage("opera")
        generateBrowserPackage("firefox")
        generateBrowserPackage("edge")

# Execute this script only, if it hasn't been imported as a module
if __name__ == "__main__":
    main()