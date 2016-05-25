if [ "$TRAVIS_PULL_REQUEST" == "false" && "$TRAVIS_BRANCH" == "master" ]; then
  echo -e "Starting to update test\n"

  #go to home and setup git
  git config --global user.email "travis@travis-ci.org"
  git config --global user.name "Travis"

  #using token clone master branch
  git clone --quiet --branch=master https://${GH_TOKEN}@github.com/CatBlock/catblock.git  master > /dev/null

  #add, commit and push files
  git add -f .
  git commit -m "Travis build $TRAVIS_BUILD_NUMBER pushed to test branch"
  git push -fq origin test > /dev/null

  echo -e "Done updating builds on GitHub."
fi