#!/usr/bin/env python3
"""Prepare a patched COPY of the existing sync server. Never restart a service.
Usage: python3 install-route.py SOURCE OUTPUT
Deploy this folder as app/fitness/server, plus fitness/{core.js,data.js,package.json}.
"""
import pathlib
import sys
source = pathlib.Path(sys.argv[1]).read_text()
marker = "  if (p === '/healthz' && M === 'GET') return [200, 'ok'];"
if source.count(marker) != 1:
    raise SystemExit('Unexpected server source; refusing to patch')
if 'createFitnessRoute' in source:
    raise SystemExit('Fitness route already present; inspect before replacing')
source = "import {createFitnessRoute} from './fitness/server/route.mjs';\n" + source
source = source.replace('// ---------- 路由 ----------', "const fitnessRoute = createFitnessRoute(DATA);\n\n// ---------- 路由 ----------", 1)
if 'const fitnessRoute = ' not in source:
    raise SystemExit('Route initialization anchor missing')
source = source.replace(marker, marker + "\n  if (p === '/v1/fitness/data') return fitnessRoute(req);")
pathlib.Path(sys.argv[2]).write_text(source)
