echo -e "Starting to update builds on GitHub"

# Go to the root of the repo
cd ..

# Setup Git
git config --global user.email "travis@travis-ci.org"
git config --global user.name "Travis"

git add -f .
git commit -m "Travis build $TRAVIS_BUILD_NUMBER pushed to the 'packages' branch"
git push origin packages

echo -e "Done updating builds on GitHub."