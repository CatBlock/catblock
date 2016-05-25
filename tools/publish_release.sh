echo -e "Starting to update builds on GitHub"

# Go to the root of the repo
cd ..

git config --global user.email "tomas@getadblock.com"
git config --global user.name "Tomáš Taro"

git stash save -u
git checkout -b packages

rm -rf builds/
mkdir builds

git stash pop

git add builds/

git commit -am "Travis build $TRAVIS_BUILD_NUMBER pushed to the 'packages' branch"
git push

echo -e "Done updating builds on GitHub."