echo -e "Starting to update builds on GitHub"

# Go to the root of the repo
cd ..

git add -f .
git commit -m "Travis build $TRAVIS_BUILD_NUMBER pushed to the 'packages' branch"
git push origin packages

echo -e "Done updating builds on GitHub."