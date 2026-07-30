#!/bin/zsh

PROJECT_DIR="${0:A:h}"
PORT=4175
RECOVERY_PORT=3000
URL="http://localhost:$PORT/admin-login.html"

if ! curl --silent --fail "http://localhost:$PORT/" >/dev/null 2>&1; then
  cd "$PROJECT_DIR/app" || exit 1
  nohup python3 -m http.server "$PORT" >/tmp/ayesha-booking-server.log 2>&1 &
  sleep 1
fi

if ! curl --silent --fail "http://localhost:$RECOVERY_PORT/" >/dev/null 2>&1; then
  cd "$PROJECT_DIR/recovery-redirect" || exit 1
  nohup python3 -m http.server "$RECOVERY_PORT" >/tmp/ayesha-recovery-server.log 2>&1 &
  sleep 1
fi

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi
