echo -e "Starting to update packages on GitHub"

# Go to the root of the repo
cd ..

cd ..

git clone https://${GH_TOKEN}@github.com/CatBlock/catblock-nightlies.git

rm -rf /builds
rm catblock-edge.zip
rm catblock-firefox.xpi
rm catblock-chrome.zip
rm catblock-opera.zip

rsync -r catblock/builds/* catblock-nightlies

cd catblock-nightlies/

git add -f .

git commit -am "Updated packages by Travis $TRAVIS_BUILD_NUMBER"

git push

echo -e "Done updating packages on GitHub"