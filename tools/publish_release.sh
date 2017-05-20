if [ "$TRAVIS_PULL_REQUEST" == "false" ] && [ "$TRAVIS_BRANCH" == "master" ];
then
    echo -e "Starting to update packages on GitHub..."

    # Go to the root of the repo
    cd ..

    git clone https://${GH_TOKEN}@github.com/CatBlock/catblock-nightlies.git

    rm -rf /builds

    rsync -r catblock/builds/* catblock-nightlies

    cd catblock-nightlies/

    git add -f .

    git commit -am "Updated packages by Travis #$TRAVIS_BUILD_NUMBER"

    git push

    echo -e "Done updating packages on GitHub."
else
    echo -e "Pull requests are not being shipped to CatBlock Nightlies repository."
fi