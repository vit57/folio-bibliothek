#!/bin/zsh
cd "${0:A:h}"
if [[ ! -f dist/index.html ]]; then
  print "Bitte einmal npm install und npm run build im Projektordner ausführen."
  read "?Enter zum Schließen"
  exit 1
fi
python3 scripts/serve.py &
folio_server_pid=$!
trap 'kill "$folio_server_pid" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:5188"
wait "$folio_server_pid"
