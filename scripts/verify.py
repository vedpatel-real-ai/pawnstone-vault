"""Capture verification commands, timings, output and JUnit results without exporting credentials."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import platform
import secrets
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

out = Path('.cache/verification')
if out.exists():
    archive = out.parent/'verification-history'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    archive.parent.mkdir(parents=True,exist_ok=True)
    out.rename(archive)
out.mkdir(parents=True, exist_ok=True)
cli = os.environ.get('PAWNTRACK_CLI', 'supabase')
def output(*cmd):
    return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()

manifest = dict(commit=output('git','rev-parse','HEAD'), started=datetime.now(timezone.utc).isoformat(),
    platform=platform.platform(), node=output('node','--version'), npm=output('npm','--version'),
    supabase=output(cli,'--version'), commands=[], suites={},
    run_url=(f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
             if 'GITHUB_RUN_ID' in os.environ else None))
def persist():
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

def check(label,command,private=False):
    start=time.monotonic()
    print(label, flush=True)
    result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if not private:
        (out/(label+'.log')).write_text(result.stdout)
    manifest['commands'].append(dict(label=label,command=[('supabase' if x==cli else x) for x in command],
        exit=result.returncode,seconds=round(time.monotonic()-start,2)))
    persist()
    if result.returncode:
        if not private: print(result.stdout[-3000:],flush=True)
        raise SystemExit(result.returncode)

def suite(label):
    root=ET.parse(out/(label+'.xml')).getroot()
    cases=list(root.iter('testcase'))
    manifest['suites'][label]=dict(tests=len(cases),failed=sum(c.find('failure') is not None or c.find('error') is not None for c in cases),
        skipped=sum(c.find('skipped') is not None for c in cases))
    persist()

def wait_edge(proc):
    for _ in range(120):
        if proc.poll() is not None: raise RuntimeError('Local Edge runtime exited')
        try:
            urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:56421/functions/v1/generate-dues',method='POST'),timeout=3)
        except urllib.error.HTTPError as error:
            if error.code==401: return
        except OSError: pass
        time.sleep(1)
    raise RuntimeError('Timed out waiting for local Edge runtime')

def run():
    check('install',['npm','ci','--no-audit','--no-fund'])
    check('build',['npm','run','build'])
    check('lint',['npm','run','lint'])
    for config in ('app','node'):
        check('typecheck-'+config,['npx','--no-install','tsc','-p',f'tsconfig.{config}.json','--noEmit'])
    check('unit',['npx','--no-install','vitest','run','--reporter=verbose','--reporter=junit','--outputFile='+str(out/'unit.xml')])
    suite('unit')
    if os.environ.get('CI'): check('chromium',['npx','--no-install','playwright','install','--with-deps','chromium'])
    check('browser',['npm','run','test:e2e'])
    suite('browser')
    check('local-stack',[cli,'start','-x','realtime,imgproxy,logflare,vector,supavisor,edge-runtime,studio,inbucket'],private=True)
    for i in range(2): check(f'fresh-{i+1}',[cli,'db','reset','--local'])
    check('legacy-schema',[cli,'db','reset','--local','--version','20250818000000'])
    check('legacy-records',['node','scripts/upgrade-fixture.mjs','seed'])
    check('upgrade',[cli,'migration','up','--local','--include-all'])
    check('reconcile',['node','scripts/upgrade-fixture.mjs','verify'])
    envfile=Path('.cache/scheduler.env')
    envfile.write_text('DUES_SCHEDULER_SECRET='+secrets.token_hex(32)+'\n')
    envfile.chmod(0o600)
    with Path('.cache/edge-runtime.log').open('w') as log:
        proc=subprocess.Popen([cli,'functions','serve','generate-dues','--env-file',str(envfile)],stdout=log,stderr=log,start_new_session=True)
        try:
            wait_edge(proc)
            for name in ('tenants','ledger','scheduler','edge','session'):
                check(name,['node','--test','--test-reporter=junit','--test-reporter-destination='+str(out/(name+'.xml')),
                    f'tests/integration/{name}.test.mjs'])
                suite(name)
        finally:
            if proc.poll() is None:
                os.killpg(proc.pid,signal.SIGTERM)
                proc.wait(timeout=20)
            envfile.unlink(missing_ok=True)

try:
    run()
finally:
    manifest['finished']=datetime.now(timezone.utc).isoformat()
    persist()
    files=sorted(p for p in out.iterdir() if p.is_file() and p.name!='checksums.sha256')
    (out/'checksums.sha256').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in files))
