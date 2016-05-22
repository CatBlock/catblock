 #!/usr/bin/python

"""
Prepare an Edge release versions of CatBlock

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import shutil # Provides folders functions

os.chdir("..") # Move CWD to the root of repo

origcwd = os.getcwd() # Save CWD for later use

os.chdir("..") # Move CWD to the top of repoprint "Preparing CatBlock for Edge release..."

# Copy the content of the original folder into "/catblock_edge/catblock"
if os.path.exists(os.getcwd() + "/catblock_edge"): # If /catblock_edge folder doesn't exist, create it
    shutil.rmtree(os.getcwd() + "/catblock_edge")

shutil.copytree(origcwd, os.getcwd() + "/catblock_edge/catblock", ignore=shutil.ignore_patterns(".git*"))

# Copy instructions file and setup file into "/catblock_edge" folder
shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/instructions.txt", os.getcwd() + "/catblock_edge/")
shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/Setup.cmd", os.getcwd() + "/catblock_edge/")

print "CatBlock for Edge has been built!"