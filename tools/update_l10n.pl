#!/usr/bin/perl
# Script for managing AdBlock translations in Chrome JSON format
#
# Just FYI, this script is the result of heavy cat /dev/urandom | perl
# until it worked. It probably could be way better and more efficient.
#
# Depending on your Perl setup, you might have to install
# some of the modules below from CPAN. For example:
#
#   cpan install JSON File::Copy::Recursive Mozilla::CA
#

use strict;
use warnings;

use utf8;
use Encode;
use FindBin;
use IO::Handle;
use File::Find;
use File::Path;
use File::Copy::Recursive qw(dirmove);
use JSON qw(decode_json);
use List::MoreUtils qw(uniq any);
use LWP::Simple qw(get getstore is_success);
use Archive::Extract qw(new extract error);
use Term::ANSIColor;

# stuff that we'll need later on
my $root = "$FindBin::Bin/../"; # AdBlock root path
my $includefile = "$root/tools/I18N_include_exclude.txt"; # include/exclude file
my $api_key_file = $ENV{"HOME"}."/.ab_crowdin_key"; # where the Crowdin API key is stored
my $api_export_url = "https://api.crowdin.com/api/project/adblock/export?json&key="; # build crowdin export
my $crowdin_url = "https://crowdin.net/download/project/adblock.zip"; # Crowdin export
my $tmp_dir = "$FindBin::Bin/l10n_tmp/"; # where to unzip locales temporarily
my $src_file = "/en/messages.json"; # source language json
my $wrong_caps = qr/(?<!get)([Aa]db|adB|AD[Bb])(?i)lock(?-i)/; # regex for wrong capitalizations of "AdBlock"

# location of locale folders for each project
my %locale_dirs = ( "adblock", "$root/_locales/",
                    "contributors", "$root/contributors/i18n/_locales/",
                    "getadblock_com", "$root/i18n/_locales/",
                    "installed", "$root/installed/i18n/_locales/"
                  );


sub export_locales {
    if (-e $api_key_file){
        # read API key from file
        open my $file, "<", $api_key_file;
        my $key = <$file>;
        close $file;

        # call API
        my $status = get($api_export_url.$key);

        # try to figure out what happened
        if (!defined $status){
            # could be internet issue, server issue, or wrong API key.
            # Crowdin throws error message jsons as 404s, and the get()
            # above only returns undef in that case, so we can't figure
            # out what exactly went wrong here
            print "build failed, something went wrong.\n";
            # not a reason to fail for now, though, as the user may
            # have built the project manually on crowdin.com
            return 1;
        } else {
            my $json = decode_json($status);
            if ($json->{"success"}{"status"} eq "built"){
                print "built successfully.\n";
            } elsif ($json->{"success"}{"status"} eq "skipped"){
                print "build skipped, previous is up to date or less than 30 minutes old.\n";
            } else {
                print "unable to determine if build succeeded.\n"
            }
        }
    } else {
        print "build skipped, no API key found.\n";
    }
}

sub get_locales {
    # make sure we don't already have other temporary files
    rmtree($tmp_dir);
    mkdir($tmp_dir);

    # download locales from Crowdin
    # if getting a 500 or SSL error, try installing/updating Mozilla::CA
    my $status = getstore($crowdin_url,"$tmp_dir/adblock.zip");
    die "\nError downloading $crowdin_url: $status\n" unless is_success($status);

    # use command line tools instead of perl modules to extract the archive
    $Archive::Extract::PREFER_BIN = 1;

    # unzip the archive
    my $ae = Archive::Extract->new(archive => "$tmp_dir/adblock.zip");
    $ae->extract(to => $tmp_dir) or die "\n".$ae->error;
}

sub dir_listing {
    # take path to a folder as input
    my $path = shift(@_);

    opendir(FOLDER,$path)
        or die "\nCan't open directory $path: $!\n";
    my @listing = readdir(FOLDER);
    closedir(FOLDER);

    # return the array of folders
    return @listing;
}

sub get_json {
    # take path to a file as input
    my $file = shift(@_);

    # read and convert the file into a hash
    my $data = read_entire_file($file);
    my $json = decode_json(encode('utf8',$data));

    # return the hash
    return $json;
}

sub check_new_locales {
    # take project we're working on as input
    my $project = shift(@_);

    # grab lists of new locales and json for source locale
    my @new_locales = dir_listing("$tmp_dir/$project/");
    my $json = get_json("$tmp_dir/$project/$src_file");

    # total number of strings in source json
    my $src_strings_count = keys($json);

    my @adblock_caps;
    foreach my $string (keys($json)){
        # find and remember strings where AdBlock is capitalized differently
        if ($json->{$string}{message} =~ /${wrong_caps}/g){
            push(@adblock_caps,$string);
        }
    }

    foreach my $language (@new_locales){
        if (($language =~ /^[a-z]{2}(_[A-Z]{2})?$/) && (-s "$tmp_dir/$project/$language/messages.json")){
            # read new file for this language
            my $strings_new = get_json("$tmp_dir/$project/$language/messages.json");

            # don't use translation if it's less than 60% done
            my $tr_strings_count = keys($strings_new);
            if ($tr_strings_count <= $src_strings_count * 0.6){
                if (-e $locale_dirs{$project}.$language."/messages.json"){
                    print colored("!", 'red'), " $language: removing translation (less than 60% complete)\n";
                }
                rmtree("$tmp_dir/$project/$language");
                next;
            }

            unless (-s $locale_dirs{$project}.$language."/messages.json"){
                print colored("!", 'red'), " $language: new translation added, has the translator been added to the credits?\n";
            }

            foreach my $string (keys($strings_new)){
                # check if "AdBlock" is capitalized correctly
                if (!grep(/^${string}$/, @adblock_caps)){
                    if ($strings_new->{$string}{message} =~ /${wrong_caps}/g){
                        print colored("!", 'red'), " $language: AdBlock capitalized incorrectly in $string\n";
                    }
                }

                # check if strings contain the right placeholders
                if ($strings_new->{$string}{placeholders}){
                    foreach my $placeholder (keys($strings_new->{$string}{placeholders})){
                        if (index($strings_new->{$string}{message}, '$'.$placeholder.'$') == -1){
                            print colored("!", 'red'), " $language: placeholder $placeholder broken in $string\n";
                        }
                    }
                }
            }

            # Chrome Web Store descriptions shouldn't exceed 132 characters
            if ($strings_new->{description2}{message}){
                if (length($strings_new->{description2}{message}) > 132){
                    print colored("!", 'red'), " $language: description2 is too long for CWS!\n";
                }
            }
        }
    }

    return 1;
}

sub read_lines_file {
    # take path to a file as input
    my $file = shift(@_);

    # read file
    open(FILE,"<:encoding(utf8)",$file)
        or die "\nCan't open file $file: $!\n";
    my @lines = <FILE>;
    close(FILE);

    # output array of lines in file
    return @lines;
}

sub read_entire_file {
    # take path to a file as input
    my $file = shift(@_);

    local $/; # enable slurp mode
    my @contents = read_lines_file($file);

    # output whole content of the file
    return $contents[0];
}

sub strings_in_use {
    # take list of files to search in as input
    my @files = @_;

    my @html_strings;
    my @js_strings;

    foreach my $file (@files){
        # store lines of the file in array
        my @lines = read_lines_file($file);

        # find all occurences of strings being used in the line
        if ($file =~ /\.html$/){
            foreach my $line (@lines){
                while ($line =~ /i18n(_(value|placeholder|title))?=["'](\w+)["']/g){
                    push(@html_strings,$3);
                }
            }
        } elsif ($file =~ /\.js$/){
            foreach my $line (@lines){
                while ($line =~ /translate\(["'](\w+)["'][,\)]/g){
                    push(@js_strings,$1);
                }
            }
        }
    }

    # combine strings found in html files and js files
    my @allstrings = (@html_strings,@js_strings);
    # make sure we don't have duplicates and sort them
    my @stringsinuse = sort(uniq(@allstrings));

    # output all strings found in code
    return @stringsinuse;
}

sub html_js_files {
    # take paths to folders to search as input
    my @folders = @_;

    my @files;

    foreach my $folder (@folders){
        # search for html and js files and store list
        find(sub{
            return unless -f;
            return unless (/\.html$/ || /\.js$/);
            push(@files,$File::Find::name);
        },$folder);
    }

    # return list of files found
    return @files;
}

sub missing_unused {
    # get the json data from the source file passed as input
    my $project = shift(@_);
    my $file = "$tmp_dir/$project/$src_file";
    my $json = get_json($file);

    my @files, my @strings;

    # find html/js files for the relevant project
    if ($project eq "contributors"){
        @files = html_js_files("$locale_dirs{$project}/../../");
    } elsif ($project eq "installed"){
        # l10n for /installed also contains l10n for /pay
        @files = html_js_files("$locale_dirs{$project}/../../", "$locale_dirs{$project}/../../../pay/");
    } elsif ($project eq "getadblock_com"){
        find(sub{
            # don't look in directories that are separate projects
            my $file = $_; # current filename
            return $File::Find::prune = 1 if (any {$file eq $_} @{["contributors", "installed", "pay"]});

            return unless -f;
            return unless (/\.html$/ || /\.js$/);
            push(@files,$File::Find::name);
        },"$locale_dirs{$project}/../../");
    } else {
        @files = html_js_files($root);
    }

    # find all the strings that are used in the html/js files
    @strings = strings_in_use(@files);

    # get includes from include/exclude file
    my @includes, my @excludes;
    if (-e $includefile){
        foreach my $line (read_lines_file($includefile)){
            if ($line =~ /^\+(\w+)/){
                push(@includes,$1);
            } elsif ($line =~ /^\-(\w+)/){
                push(@excludes,$1);
            }
        }
    }

    # find strings that need to be removed
    my @unused;
    foreach my $string (keys($json)){
        # if the string is not in the code and is not an include
        if (!grep(/^${string}$/,@strings) && !grep(/^${string}$/,@includes)){
            push(@unused,$string);
        }
    }

    # find strings that are missing from the json
    my @missing;
    foreach my $string (@strings){
        if (!$json->{$string} && !grep(/^${string}$/,@excludes)){
            push(@missing,$string)
        }
    }

    my %unused_missing = (
        unused => [@unused],
        missing => [@missing]
    );

    # returns a hash of unused and missing strings
    return %unused_missing;
}

sub print_unused_missing {
    # get a hash of unused and missing strings as input
    my %strings = @_;

    my $unusedcount = @{$strings{unused}};
    my $missingcount = @{$strings{missing}};

    # print unused/missing strings, if any
    if ($unusedcount > 0 || $missingcount > 0){
        print "\n";

        if (@{$strings{unused}}){
            print colored("!", 'red'), " Found $unusedcount UNUSED strings:\n";
            foreach my $string (@{$strings{unused}}){
                print "  - $string\n";
            }
        }

        if (@{$strings{missing}}){
            print colored("!", 'red'), " Found $missingcount ", colored("MISSING", 'bold'), " strings:\n";
            foreach my $string (@{$strings{missing}}){
                print "  - $string\n";
            }
        }
    } else {
        print "none found.\n"
    }

    return 1;
}

sub rename_folder_structure {
    # take path to the root folder as input
    my $localesroot = shift(@_);

    # grab a list of the locale folders
    my @localeslist = dir_listing($localesroot);

    # rename folders for languages that don't have several variants
    # e.g. en_US becomes en, unless there are other variants like en_GB
    foreach my $folder (@localeslist){
        if ((-d $localesroot.$folder) && ($folder =~ /^[a-z]{2}_[A-Z]{2}$/)){
            my $language = substr($folder,0,2);
            my @variants = grep(/^$language/,@localeslist);
            if ($#variants == 0){
                rename($localesroot.$folder,$localesroot.$language);
            }
        }
    }

    # apparently Chrome absolutely wants Norwegian to be nb
    if (-d $localesroot."no"){
        rename($localesroot."no",$localesroot."nb");
    }

    return 1;
}

sub main {
    # disable output buffering
    STDERR->autoflush(1);
    STDOUT->autoflush(1);

    # correctly display UTF-8 characters
    binmode(STDOUT, ":utf8");

    print "> Building Crowdin archive... ";
    export_locales();

    print "> Downloading and extracting locales... ";
    get_locales();
    print "done.\n";

    foreach my $project (keys(%locale_dirs)){
        if (-d $locale_dirs{$project}){
            if ($project ne "adblock"){
                print colored("> Working on $project", 'bold'), "\n";
            }

            print "> Renaming Crowdin directory structure... ";
            rename_folder_structure("$tmp_dir/$project/");
            print "done.\n";

            print "> Checking new locales... \n";
            check_new_locales($project);

            print "> Looking for unused or missing strings... ";
            my %strings = missing_unused($project);
            print_unused_missing(%strings);

            print "> Replacing previous locales... ";
            rmtree($locale_dirs{$project});
            dirmove("$tmp_dir/$project/",$locale_dirs{$project})
                or die "\nCan't copy new locales: $!\n";
            print "done.\n";

            if ($project ne "adblock"){
                print colored("> Finished $project", 'bold'), "\n";
            }
        }
    }

    print "> Cleaning up... ";
    rmtree($tmp_dir);
    print "done.\n";

    return 1;
}

# where the magic happens
main();
