## How to build the extension and/or create a development environment?

### Requirements
- [Python 3.x](https://www.python.org)

We've created an automated script called ```make_release.py```, which you can find in ```/tools``` directory and helps us with generating of our CatBlock extension for a specific browser and creating a development environment.

### Example
Here is an example, how to build CatBlock for _Google Chrome_ as a _packed_ .crx extension.
Just run the following command in the project directory:

``` python3 tools/make_release.py -b chrome -ext y```

When building a packed extension, the extension will be named as ```catblock-platform.platformsuffix``` and located in ```/builds``` folder, where:
- ```platform``` is the name of the browser you are building for
- ```platformsuffix``` is either ```.zip``` or one of the following: ```.crx```, ```.xpi``` or ```.nex```
This one specifically with a ```catblock-chrome.crx``` file in it.

### Arguments
This script accepts 3 arguments:

- ```-b``` argument:
  * is mandatory
  * specifies, what browser you are building CatBlock for
  * must be one of the following: ```chrome```, ```firefox```, ```opera``` or ```edge```
  * NOTE: building CatBlock for Safari is _not supported_ at the moment

- ```-ext``` argument:
  * is optional
  * specifies, whether a packed extension should be generated
  * must be one of the following, when ```-ext``` is defined:
    * ```browser``` => creates a .zip file with _platform-specific_ suffix (intended for loading a packed extension in a browser)
    * ```zip``` => creates a .zip file with _.zip_ suffix (intended for uploading to extension stores)
  * when ```-ext``` argument is not defined, a packed extension won't be generated at all
  * NOTE: CatBlock for Edge is always generated with _.zip_ suffix, since a tool for converting extensions to the .appx format is not publicly available (yet).

- ```-devenv``` argument:
  * is optional
  * specifies, whether an unpacked development environment should be created
  * must be one of the following, when ```-devenv``` is defined:
    * ```yes``` => creates an unpacked development environment
    * ```no``` => doesn't create an unpacked development environment
  * when ```-devenv``` argument is not defined, an unpacked environment won't be generated


## How to sideload CatBlock?
We strongly recommend, that you install CatBlock from [official extensions stores](https://github.com/CatBlock/catblock#installation) but feel free to sideload CatBlock and see, how it works!

There's also a nightly version of CatBlock called, well, CatBlock Nightly :)
Find out more about CatBlock Nightly from a [dedicated repository](https://github.com/CatBlock/catblock-nightlies).

Alright, let's proceed to the sideloading part of this doc!

First, you will need to:
- either create an unpacked development environment
- or generate a packed extension (choose platform-specific suffix for Firefox, .zip suffix for other browsers!)

It's up to you, what method you choose.

### In Google Chrome
When you've generated an unpacked development environment:

1. Go to the Chrome menu > ```Tools``` > ```Extensions```
2. Check ```Developer mode``` then press ```Load unpacked extension...```
3. Select the generated ```catblock_chrome``` folder in the project directory
4. That's it!

When you've generated a packed extension:

1. Navigate to ```chrome://extensions``` page
2. Navigate to ```/builds``` folder and locate ```catblock-chrome.crx``` file
3. Drag ```catblock-chrome.crx``` file and drop it to the Extensions page you've opened in the first step
4. That's it!

### In Opera
When you've generated an unpacked development environment:

1. Navigate to ```opera://extensions```
2. Press ```Developer Mode``` button and then press ```Load Unpacked Extension...``` button
3. Select the generated ```catblock_opera``` folder in the project directory
4. That's it!

When you've generated a packed extension:

1. Open ```opera://extensions``` page
2. Navigate to ```/builds``` folder and locate ```catblock-opera.nex``` file
3. Drag ```catblock-opera.nex``` file and drop it to the Extensions page you've opened in the first step
4. That's it!

### In Firefox
When you've generated an unpacked development environment:

1. Navigate to ```about:debugging``` page
2. Tick ```Enable add-on debugging``` option
3. Click on ```Load Temporary Add-on``` button
4. Select the generated ```catblock_firefox``` folder in the project directory
5. That's it!

When you've generated a packed extension:

1: Please make sure, that you've generated packed extension with _.zip_ suffix!
2. Make sure that you are running Firefox Developer Edition or Firefox Nightly!
3. Go to ```about:config``` and set ```xpinstall.signatures.required``` to false
4. Go to ```about:addons``` => click on settings icon
5. Select ```Install Add-on from file...```
6. Select ```catblock-firefox.xpi``` file
7. That's it!

### In Microsoft Edge
NOTE: Currently, there is no way, how to generate a packaged .appx extension/application for Microsoft Edge browser.

When you've created an unpacked development environment:

1. Navigate to ```catblock_edge``` folder
2. Run ```Setup.cmd``` file
3. Start up Edge, open up ```about:flags``` page
4. Make sure that checkbox next to ```Enable extension developer features``` is selected
5. Restart Edge
6. Click on three dots (...) and then on ```Extensions``` in menu
7. Click on ```Load extension```
8. Select unpacked "catblock" folder

Yet another note:

After each startup of Edge browser, you won't immediately see CatBlock as an installed extension, because it hasn't been signed and released to the Windows Store.
After cca. 10 seconds you get a prompt, whether you want to load with two options => whether you want to load unsigned extensions or not.