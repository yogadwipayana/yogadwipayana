pm2 stop yogadwipayana
pm2 delete yogadwipayana
git stash
git pull
npm install
npm run build
PORT=3000 pm2 start npm --name "yogadwipayana" -- run start

pm2 save
