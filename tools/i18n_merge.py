#!/usr/bin/env python3

"""
Python 3 script for managing CatBlock translations in Chrome JSON format

It is intended for:
- downloading CatBlock language files from Crowdin
- merging them with AdBlock language files

Author: Kieran Peckett, Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import urllib.request # Provides functions related to HTTP communication
import zipfile # Provides functions related to zip files

os.chdir("..") # Move CWD to root of repo

API_KEY = open(os.getcwd() + "/.crowdin_key").read() # Read the API key from file
API_URL = "https://api.crowdin.com/api/project/catblock"

EXPORT_URL = API_URL + "/export?key=" + API_KEY + "&json=true"
DOWNLOAD_URL = API_URL + "/download/all.zip?key=" + API_KEY

# Build project languages
print("Building project's language messages:")

req = urllib.request.urlopen(EXPORT_URL).read()
data = json.loads(req.decode("utf-8"))

status = data["success"]["status"]

if status == "built":
    print(" - Project has been built successfully")
elif status == "skipped":
    print(" - Build has been skipped, previous is up-to-date or less than 30 minutes old")

# Download languages packed in a .zip file
print("Downloading .zip file containing language messages:")

req = urllib.request.urlretrieve(DOWNLOAD_URL, "translations.zip")

# Extract them
print(" - Extracting languages")

zip = zipfile.ZipFile("translations.zip")
zip.extractall(os.getcwd() + "/catblock/_locales")

print(" - Removing .zip file")
os.remove(os.getcwd() + "/translations.zip")


# Merging languages
print("Merging language messages:")
ab_locales = os.listdir(r"_locales") # Load a list of all locales in the AdBlock locales folder

for locale in ab_locales: # "locale" below is the locale selected for this loop
    print (" - Merging i18n file for locale: " + locale)
    with open("_locales/" + locale + "/messages.json", "rU") as ab_read: # Opens the AdBlock i18n file in a secure manner for read-only
        # If we don't have CatBlock's specific language file, then merge CatBlock's english language file into AdBlock's language file
        try:
            with open("catblock/_locales/" + locale + "/messages.json", "rU") as cb_file: # Opens the CatBlock i18n file in a secure manner
                ab_messages = json.load(ab_read) # Creates a dict of all messages in the AdBlock file
                cb_messages = json.load(cb_file) # Creates a dict of all messgaes in the CatBlock file
                ab_messages.update(cb_messages) # Updates the AdBlock strings with the CatBlock ones
            # Closes CatBlock messages file
        except:
            with open("catblock/_locales/" + "en" + "/messages.json", "rU") as cb_file: # Opens the CatBlock i18n file in a secure manner
                ab_messages = json.load(ab_read) # Creates a dict of all messages in the AdBlock file
                cb_messages = json.load(cb_file) # Creates a dict of all messgaes in the CatBlock file
                ab_messages.update(cb_messages) # Updates the AdBlock strings with the CatBlock ones
            # Closes AdBlock messages file
        with open("_locales/" + locale + "/messages.json", "w") as ab_write: # Open the AdBlock i18n file as write-only (will overwite data!)
            ab_write.write(json.dumps(ab_messages, ensure_ascii=False, sort_keys=False, indent=2, separators=(',', ':'))) # Writes the JSON data to the AdBlock file in an easy-to-read format
        # Closes AdBlock messages file
    print (" - Merged i18n file for locale: %s" % locale)

# Done!
