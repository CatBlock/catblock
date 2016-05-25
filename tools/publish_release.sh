echo -e "Starting to update builds on GitHub"

# Go to the root of the repo
cd ..

# Create /builds folder in the root
mkdir ~/builds

# Copy builds to the /builds folder
cp builds/* ~/builds

# Go to the root folder
cd

# Setup Git
git config --global user.email "travis@travis-ci.org"
git config --global user.name "Travis"

# Using token clone packages branch
git clone --branch=packages https://${GH_TOKEN}@github.com/CatBlock/catblock.git

# Add, commit and push files
cd catblock/

cp ~/builds builds/*

git add -f .
git commit -m "Travis build $TRAVIS_BUILD_NUMBER pushed to the 'packages' branch"
git push origin HEAD

echo -e "Done updating builds on GitHub."