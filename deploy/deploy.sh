#!/usr/bin/env bash
# Build + ship to brain.bcsmethai.com.  Usage: bash deploy/deploy.sh        (build, pack, upload, restart)
#                                            bash deploy/deploy.sh pack   (build + pack into .deploy only)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${BC_DEPLOY_HOST:?set BC_DEPLOY_HOST=root@<server>}
APP=/opt/bcbrain

npm run build                       # prebuild runs the secret scan and aborts on any hit
rm -rf .deploy && mkdir .deploy
cp -r .next/standalone/. .deploy/
cp -r .next/static .deploy/.next/static
cp -r public vault .deploy/
[ "${1:-}" = pack ] && { echo "packed into .deploy"; exit 0; }

tar -czf bcbrain.tar.gz -C .deploy .
scp -q bcbrain.tar.gz deploy/bcbrain.service "$HOST:/tmp/"
ssh "$HOST" "set -e
  rm -rf $APP.new && mkdir -p $APP.new && tar -xzf /tmp/bcbrain.tar.gz -C $APP.new && rm /tmp/bcbrain.tar.gz
  rm -rf $APP.prev; if [ -d $APP ]; then mv $APP $APP.prev; fi; mv $APP.new $APP
  mv /tmp/bcbrain.service /etc/systemd/system/bcbrain.service
  systemctl daemon-reload && systemctl enable -q bcbrain && systemctl restart bcbrain
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS -o /dev/null http://127.0.0.1:3951/ && break; sleep 1; done
  curl -sS -o /dev/null -w 'local health: %{http_code}\n' http://127.0.0.1:3951/"
rm -f bcbrain.tar.gz
echo "deployed. rollback: ssh $HOST 'mv $APP $APP.bad && mv $APP.prev $APP && systemctl restart bcbrain'"
