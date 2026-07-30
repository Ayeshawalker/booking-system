#!/bin/zsh

PROJECT_DIR="${0:A:h}"
PORT=4175
URL="http://localhost:$PORT/index.html"

if ! curl --silent --fail "http://localhost:$PORT/" >/dev/null 2>&1; then
  cd "$PROJECT_DIR/app" || exit 1
  nohup python3 -m http.server "$PORT" >/tmp/ayesha-booking-server.log 2>&1 &
  sleep 1
fi

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi
