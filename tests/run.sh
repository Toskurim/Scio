#!/bin/bash
# Prova automatica di AI.st.ain: avvia un piccolo server locale ed esegue i test nel browser (Playwright).
# Uso: dalla cartella del progetto:  bash tests/run.sh      (serve Node.js e:  npm i -g playwright && npx playwright install chromium)
cd "$(dirname "$0")/.."
python3 -m http.server 8766 >/dev/null 2>&1 & SRV=$!
sleep 1
export NODE_PATH="$(npm root -g)"
for t in t14 t26 t33 t36 t37 t39 t40; do echo "== $t"; node tests/$t.js 2>&1 | grep -a "FALLITO\|TUTTO OK\|ERRORI\|Error" ; done
kill $SRV
