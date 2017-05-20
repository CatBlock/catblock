#!/usr/bin/env python3

"""
Python 3 script for managing CatBlock translations in Chrome JSON format

It is intended for:
- downloading AdBlock language files from Crowdin
- downloading CatBlock language files from Crowdin
- merging them with AdBlock language files
- and a lot of other stuff..

Author: Tomas Taro, Kieran Peckett
License: GNU GPLv3
"""

# TODO: Implement handling of translators.json file

import json # Provides JSON-related functions
import os # Provides file-system functions
import urllib.request # Provides functions related to HTTP communication
import zipfile # Provides functions related to zip files
import glob # Provides functions for iterating over unknown files
import re # Provides regexp functions
import shutil # Provides folders functions

# Declaration of some used constants
CURRENT_AB_LANG_FILE = "_locales/en/messages.json"
INCLUDE_EXCLUDE_FILE = "tools/I18N_include_exclude.txt"
MAIN_AB_LANG_FILE = "ab_locales/en/messages.json"
MAIN_CB_LANG_FILE = "cb_locales/en/messages.json"

# Links for later usage
AB_API_KEY = ""
AB_API_URL = "https://api.crowdin.com/api/project/adblock"
AB_EXPORT_URL = ""
AB_DOWNLOAD_URL = ""

CB_API_KEY = ""
CB_API_URL = "https://api.crowdin.com/api/project/catblock"
CB_EXPORT_URL = ""
CB_DOWNLOAD_URL = ""

# Try to get the API keys from files or from cache on Travis
if os.environ.get("TRAVIS") == None:

    if os.path.exists(os.environ.get("HOME") + "/.ab_crowdin_key"):
        AB_API_KEY = open(os.environ.get("HOME") + "/.ab_crowdin_key").read()
    else:
        raise FileNotFoundError("File with AdBlock's API key wasn't found.")

    if os.path.exists(os.environ.get("HOME") + "/.cb_crowdin_key"):
        CB_API_KEY = open(os.environ.get("HOME") + "/.cb_crowdin_key").read()
    else:
        raise FileNotFoundError("File with CatBlock's API key wasn't found.")

else:
    if os.environ.get("AB_CROWDIN_KEY") == None or os.environ.get("CB_CROWDIN_KEY") == None:
        # We are building from a fork, hence no private variables are exported
        print("API keys were not found, existing from a script.")
        # For forks, exiting this script with 0 is allowed
        sys.exit(0)

    AB_API_KEY = os.environ.get("AB_CROWDIN_KEY")
    CB_API_KEY = os.environ.get("CB_CROWDIN_KEY")

AB_EXPORT_URL = AB_API_URL + "/export?key=" + AB_API_KEY + "&json=true"
AB_DOWNLOAD_URL = AB_API_URL + "/download/all.zip?key=" + AB_API_KEY

CB_EXPORT_URL = CB_API_URL + "/export?key=" + CB_API_KEY + "&json=true"
CB_DOWNLOAD_URL = CB_API_URL + "/download/all.zip?key=" + CB_API_KEY

# Function for bold-printing
def printBold(string):
    print("\033[1m" + string + "\033[0m")

# Build a Crowdin archive for a chosen project
def buildArchive(project):
    if project == "adblock":
        printBold("Building AdBlock language archive...")

        request = urllib.request.urlopen(AB_EXPORT_URL).read()

    elif project == "catblock":
        printBold("Building CatBlock language archive...")

        request = urllib.request.urlopen(CB_EXPORT_URL).read()

    data = json.loads(request.decode("utf-8"))
    status = data["success"]["status"]

    if status == "built":
        print(" - Project has been built successfully")
    elif status == "skipped":
        print(" - Build has been skipped, previous is up-to-date or less than 30 minutes old")

# Download language archives for AdBlock and CatBlock projects
# and extract them afterwards
def downloadAndExtractArchive(project):
    if project == "adblock":
        print(" - Downloading AdBlock language archive...", end="")

        request = urllib.request.urlretrieve(AB_DOWNLOAD_URL, "ab_translations.zip")

        print("done.")

        print(" - Extracting language archive...", end="")
        zip = zipfile.ZipFile("ab_translations.zip")

        # Clean up ab_locales/ directory, before we continue
        if not os.path.exists("ab_locales"):
            os.makedirs("ab_locales")
        else:
            shutil.rmtree("ab_locales")
            os.makedirs("ab_locales")

        # Extract only those files we need
        for file in zip.namelist():
            if file.startswith("adblock/"):
                zip.extract(file, "ab_locales")

        print("done.")

        print(" - Removing archive...", end="")
        os.remove("ab_translations.zip")

        print("done.")

    elif project == "catblock":
        print(" - Downloading CatBlock language archive...", end="")

        req = urllib.request.urlretrieve(CB_DOWNLOAD_URL, "cb_translations.zip")

        print("done.")

        print(" - Extracting language archive...", end="")

        zip = zipfile.ZipFile("cb_translations.zip")

        # Clean up cb_locales/ directory, before we continue
        if not os.path.exists("cb_locales"):
            os.makedirs("cb_locales")
        else:
            shutil.rmtree("cb_locales")
            os.makedirs("cb_locales")

        zip.extractall("cb_locales")

        print("done.")

        print(" - Removing archive...", end="")
        os.remove("cb_translations.zip")

        print("done.")

def renameFolderStructure(project):

    if project == "adblock":
        # Ensure, that directory is clean before we continue
        for folder in os.listdir("ab_locales"):
            if folder != "adblock":
                shutil.rmtree("ab_locales/" + folder)

        # Rename folders for languages that don't have several variants
        # e.g. en_US becomes en, unless there are other variants like en_GB
        for filename in os.listdir("ab_locales/adblock/"):

            file_counter = 0

            for file in os.listdir("ab_locales/adblock/"):
                if filename[:2] in file:
                    file_counter = file_counter + 1

            if file_counter == 1:
                os.rename("ab_locales/adblock/" + filename, "ab_locales/adblock/" + filename[:2])
            else:
                os.rename("ab_locales/adblock/" + filename, "ab_locales/adblock/" + filename)

        # Remove empty directory
        for filename in os.listdir("ab_locales/adblock/"):
            os.rename("ab_locales/adblock/" + filename, "ab_locales/" + filename)

        shutil.rmtree("ab_locales/adblock")

    elif project == "catblock":
        # Rename folders for languages that don't have several variants
        # e.g. en_US becomes en, unless there are other variants like en_GB
        for filename in os.listdir("cb_locales/"):

            file_counter = 0

            for file in os.listdir("cb_locales/"):
                if filename[:2] in file:
                    file_counter = file_counter + 1

            if file_counter == 1:
                os.rename("cb_locales/" + filename, "cb_locales/" + filename[:2])
            else:
                os.rename("cb_locales/" + filename, "cb_locales/" + filename[:2] + "_" + filename[3:])

# Check, whether all files are translated properly (at least 60% translated strings)
# If some translated file won't meed this criteria,
# translated strings will be replaced with english strings
def ensureFileExistence():
    printBold("Checking persistence of all needed files...")

    printBold(" - Checking, whether all language files are translated properly...")

    stringsCount = 0
    with open("ab_locales/en/messages.json") as file:
        ab_strings = json.load(file)
        stringsCount = len(ab_strings)

        for lang_folder in os.listdir("ab_locales"):
            with open("ab_locales/" + lang_folder + "/messages.json") as lang_file:
                lang_file_strings = json.load(lang_file)
                strings_count = len(lang_file_strings)

                if strings_count < 0.6 * stringsCount:
                    print("  - Removing translation (less than 60% complete): " + "ab_locales/" + lang_folder + "/messages.json")
                    os.remove("ab_locales/" + lang_folder + "/messages.json")
                    shutil.copy2("ab_locales/en/messages.json", "ab_locales/" + lang_folder + "/messages.json")

    printBold(" - Checking existence of all needed files...")

    for ab_file in os.listdir("ab_locales/"):
        if not os.path.exists("_locales/" + ab_file):
            print("  - Creating _locales/" + ab_file + "/messages.json")

            os.makedirs("_locales/" + ab_file + "/")
            shutil.copy2("ab_locales/en/messages.json", "_locales/" + ab_file + "/messages.json")

        if not os.path.exists("cb_locales/" + ab_file):
            print("  - Creating cb_locales/" + ab_file + "/messages.json")

            os.makedirs("cb_locales/" + ab_file + "/")
            shutil.copy2("cb_locales/en/messages.json", "cb_locales/" + ab_file + "/messages.json")

    for cb_file in os.listdir("cb_locales/"):
        if not os.path.exists("ab_locales/" + cb_file):
            print("  - Creating ab_locales/" + cb_file + "/messages.json")

            os.makedirs("ab_locales/" + cb_file + "/")
            shutil.copy2("ab_locales/en/messages.json", "ab_locales/" + cb_file + "/messages.json")

        if not os.path.exists("_locales/" + cb_file):
            print("  - Creating _locales/" + cb_file + "/messages.json")

            os.makedirs("_locales/" + cb_file + "/")
            shutil.copy2("ab_locales/en/messages.json", "_locales/" + cb_file + "/messages.json")

# Get all i18n strings, which are in .html and .js files
def getStringsInFiles():

    # Helper function for getting all i18n strings from .js files
    def JSstringsInUse(array):

        usedStrings = []
        regex = re.compile("translate\([\"\'](\w+)[\"\'][,\)]")

        for file in array:
            lines = tuple(open(file, "r"))
            for line in lines:
                matches = regex.findall(line)
                if len(matches) > 0:
                    for i in range(0, len(matches)):
                        usedStrings.append(matches[i])

        return usedStrings

    # Helper function for getting all i18n strings from .html files
    def HTMLstringsInUse(array):

        usedStrings = []
        regex = re.compile("i18n(_(value|placeholder|title))?=[\"\'](\w+)[\"\']")

        for file in array:
            lines = tuple(open(file, "r"))
            for line in lines:
                matches = regex.findall(line)
                if len(matches) > 0:
                    for i in range(0, len(matches)):
                        usedStrings.append(str(matches[i]).split("'")[5])

        return usedStrings

    # Find all .html and .js files
    html_files = []
    js_files = []

    for filename in glob.iglob("**/*.html", recursive=True):
        html_files.append(filename)

    for filename in glob.iglob("**/*.js", recursive=True):
        js_files.append(filename)

    # Extract all i18n strings we are using in those files
    htmlStrings = HTMLstringsInUse(html_files)
    jsStrings = JSstringsInUse(js_files)

    # Concatenate all .html and .js strings into one list
    usedStrings = list(set(htmlStrings + jsStrings))

    return usedStrings

# Detect all ported, unused and missing i18n strings
def detectUnusedAndMissingStrings(usedStrings):
    printBold("Finding notfound, ported, unused and missing strings...")

    # Open up INCLUDE_EXCLUDE_FILE and extract
    # all +included and -excluded strings
    lines = tuple(open(INCLUDE_EXCLUDE_FILE, "r"))

    includedStringRegex = re.compile("\+(\w+)")
    excludedStringRegex = re.compile("\-(\w+)")

    includedStrings = []
    excludedStrings = []

    for line in lines:
        matches = includedStringRegex.findall(line)
        if matches:
            includedStrings.append(matches[0])

    for line in lines:
        matches = excludedStringRegex.findall(line)
        if matches:
            excludedStrings.append(matches[0])

    # Detect all ported, unused and missing strings
    notfound = []
    ported = []
    unused = []
    missing = []

    with open(CURRENT_AB_LANG_FILE) as curr_ab_lang_messages:
        curr_ab_keys = json.load(curr_ab_lang_messages)

        with open(MAIN_AB_LANG_FILE) as ab_lang_messages:
            new_ab_keys = json.load(ab_lang_messages)

            with open(MAIN_CB_LANG_FILE) as cb_lang_messages:
                cb_keys = json.load(cb_lang_messages)

                for curr_ab_key in curr_ab_keys:
                    if curr_ab_key not in new_ab_keys and curr_ab_key not in cb_keys:
                        notfound.append(curr_ab_key)

                for ab_key in new_ab_keys:
                    if ab_key not in usedStrings and ab_key not in includedStrings:
                        if "catblock_" + ab_key in cb_keys:
                            ported.append(ab_key)
                        else:
                            unused.append(ab_key)

                # usedStrings is an array with all used strings
                # contained in .html and .js files
                for string in usedStrings:
                    if string not in new_ab_keys and string not in curr_ab_keys and string not in cb_keys and string not in excludedStrings:
                        missing.append(string)


        return notfound, ported, unused, missing

# Print out useful info about strings
def printStringsOfDiffType(strings):

    notfoundStrings = strings[0]
    portedStrings = strings[1]
    unusedStrings = strings[2]
    missingStrings = strings[3]

    if len(notfoundStrings) > 0:
        # These strings are in the code and in the current language file,
        # but can't be found in the updated language file
        printBold(" - Following strings are still used and CANNOT be found in updated AB language file:")
        # TODO: Port this string from all old AB language files into all new AB language files
        for string in notfoundStrings:
            print("  - " + string)

    if len(portedStrings) > 0:
        # These JSON strings have a CB equivalent, they can be safely removed
        printBold(" - Following strings have a CB equivalent string with 'catblock_' prefix:")
        # TODO: Remove ported strings from all AB language files
        for string in portedStrings:
            print("  - " + string)

    if len(unusedStrings) > 0:
        # These JSON strings are not used in the code, they can be safely removed
        printBold(" - Following strings are not used in the code:")
        # TODO: Remove unused strings from ALL language files
        for string in unusedStrings:
            print("  - " + string)

    if len(missingStrings) > 0:
        # These HTML/JS strings SHOULD BE in current english language file,
        # but are not for some reason (add them manually)
        printBold(" - Following strings are used in the code BUT can't be found in language file:")
        for string in missingStrings:
            print("  - " + string)

# Merge temporary CatBlock strings into temporary AdBlock strings
def mergeStrings():
    printBold("Merging CatBlock and AdBlock language files...")

    for lang_folder in os.listdir("cb_locales/"):
        with open("cb_locales/" + lang_folder + "/messages.json", "rU") as cb_file:

            cb_keys = json.load(cb_file)

            with open("ab_locales/" + lang_folder + "/messages.json", "r+") as ab_file:
                ab_keys = json.load(ab_file)

                if len(ab_keys) > 0:
                    ab_keys.update(cb_keys)

                    print(" - Updating ab_locales/" + lang_folder + "/messages.json")

                    # Clean up the file
                    ab_file.seek(0)
                    ab_file.truncate()

                    # Save the merged keys into the AB file
                    ab_file.write(json.dumps(ab_keys, ensure_ascii=False, sort_keys=True, indent=2, separators=(",", ": ")))

                    # Close files after saving
                    ab_file.close()
                    cb_file.close()

# Move locales from temporary folder to the /_locales folder
def moveFiles():
    printBold("Replacing previous locales...")

    for lang_folder in os.listdir("ab_locales/"):
        shutil.copy2("ab_locales/" + lang_folder + "/messages.json", "_locales/" + lang_folder + "/")

# Remove temporary folders
def cleanUp():
    printBold("Cleaning up temporary folders...")

    shutil.rmtree("ab_locales")
    shutil.rmtree("cb_locales")

    printBold("Done!")

def main():

    buildArchive("adblock")
    downloadAndExtractArchive("adblock")
    renameFolderStructure("adblock")

    buildArchive("catblock")
    downloadAndExtractArchive("catblock")
    renameFolderStructure("catblock")

    ensureFileExistence()

    usedStrings = getStringsInFiles()
    strings = detectUnusedAndMissingStrings(usedStrings)

    printStringsOfDiffType(strings)

    mergeStrings()
    moveFiles()
    cleanUp()

main()