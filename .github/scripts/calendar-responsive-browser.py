"""Compiled calendar route acceptance, with local-only synthetic APIs.
No host session, real properties, provider requests or production mutations.
"""
import asyncio
import json
import os
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, expect

OUT = Path('evidence/calendar-responsive')
OUT.mkdir(parents=True, exist_ok=True)
DIST = Path.cwd() / 'dist'
URL = 'http://127.0.0.1:4173/properties/local-property/calendar'
STATE = {'mode': 'live', 'calls': [], 'unexpected': [], 'errors': [], 'console': []}
RESULTS = []
STAMP = '2026-10-15T12:00:00.000Z'
PROPERTY = {'id':'local-property','name':'LOCAL RESPONSIVE FIXTURE','baseNightlyRate':432,'minimumNightlyRate':99,'maximumNightlyRate':1500,'minimumNights':2,'maximumNights':14,'dynamicPricingEnabled':True,'distributionEnabled':False,'distributionStatus':'INACTIVE'}

class Static(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        if not (DIST / urlparse(self.path).path.lstrip('/')).is_file():
            self.path = '/index.html'
        super().do_GET()

def snapshot():
    if STATE['mode'] == 'unavailable':
        return None
    issue = {'issueCode':'LOCAL_CLEANING','title':'Cleaning requires host attention','issue':'Confirmation has not arrived for this local fixture.','operationalImpact':'Arrival readiness needs review.','recommendedAction':'Open the reservation and review cleaning status.','engine':'Cleaning','severity':'CRITICAL','workflowState':'ACTION_REQUIRED','visibility':'HOST','responsibleActor':'HOST','actionRequired':True,'canAutoResolve':False,'autoResolveStatus':'NOT_SUPPORTED','reservationId':'local-reservation','reservationNumber':'PG-2026-LOCAL-000001','guestName':'LOCAL guest with a long display name','firstDetectedAt':STAMP,'lastSignalAt':STAMP,'actionTarget':'RESERVATION'}
    history = [{'decisionId':'local-history','engine':'Cleaning','status':'SUCCESS','summary':'Local completion history','startedAt':STAMP,'completedAt':STAMP}]
    data = {'generatedAt':STAMP,'autopilotStatus':'ACTIVE','entityId':'local-property','freedomMetrics':{'minutesReturned':45,'interventionsAvoided':12,'autonomousDecisions':24},'autonomyScore':{'score':87,'operationalSuccessRate':87,'humanInterventions':1},'guestJourneyMetrics':{'activeReservations':12,'reservationConfirmed':10,'verificationPending':2,'verificationCompleted':10,'accessScheduled':10,'readyForArrival':8,'completionRate':67,'hostInterventionRequired':1},'operationalItems':[issue],'currentOperationalState':[issue],'hostActionQueue':[issue],'waitingItems':[],'autoResolvingItems':[],'recentlyResolved':[],'recommendedActions':[],'activityHistory':history,'recentAuditEntries':history}
    if STATE['mode'] == 'legacy':
        data.pop('operationalItems')
        data['recommendedActions'] = [{'priority':'CRITICAL','requiresHumanAction':True,'engine':'Messaging','title':'Local legacy alert remains visible','reservationId':'local-reservation','reservationNumber':'PG-2026-LOCAL-000001','canAutoResolve':False}]
    return data

async def intercept(route):
    req = route.request
    url = urlparse(req.url)
    path = url.path.removeprefix('/backend')
    if url.hostname not in ('localhost','127.0.0.1'):
        STATE['unexpected'].append(req.method+' '+req.url)
        await route.abort()
        return
    data = None
    if path == '/api/public/brand-context':
        data = {'ok':True,'data':{'kind':'PIN_GO_STANDARD','displayName':'Pin&Go','logoUrl':None,'faviconUrl':None,'primaryColor':None,'onPrimaryColor':None,'organizationSlug':None,'version':None,'poweredByPinGo':True}}
    elif path == '/auth/me':
        data = {'user':{'id':'local-user','email':'local@example.invalid','orgId':'local-org','role':'ORG_ADMIN','organizationName':'LOCAL TEST ONLY'}}
    elif path == '/api/org/branding/review':
        data = {'ok':True,'profile':None,'pendingRevisions':[]}
    elif path == '/api/dashboard/properties/local-property':
        data = {'ok':True,'item':PROPERTY}
    elif path.endswith('/nightly-rates') and req.method == 'GET':
        q = parse_qs(url.query)
        start = datetime.fromisoformat(q['from'][0])
        end = datetime.fromisoformat(q['to'][0])
        dates = [start+timedelta(days=i) for i in range((end-start).days)]
        data = {'rates':[{'date':d.strftime('%Y-%m-%d'),'rate':1234 if d.day == 20 else 432,'appliedRules':['SEASONAL_RULE','WEEKEND_RULE']} for d in dates]}
    elif path == '/api/dashboard/reservations':
        data = {'items':[{'id':'local-reservation','reservationNumber':'PG-2026-LOCAL-000001','guestName':'LOCAL long guest name','checkIn':'2026-10-24T15:00:00Z','checkOut':'2026-10-26T11:00:00Z','status':'CONFIRMED','source':'DIRECT_BOOKING'}]}
    elif path.endswith('/blocked-dates'):
        data = {'items':[{'id':'local-block','date':'2026-10-28','startDate':'2026-10-28','endDate':'2026-10-29','reason':'LOCAL maintenance block'}]}
    elif path.endswith('/mission-control'):
        data = {'ok':True,'item':snapshot()}
    elif path.endswith('/manual-reservations/quote'):
        data = {'ok':True,'item':{'currency':'USD','nights':2,'nightlySubtotal':864,'cleaningFee':30,'taxAmount':0,'taxTotal':0,'totalAmount':894,'total':894}}
    elif path.endswith('/calendar-overrides') and req.method in ('PUT','DELETE'):
        data = {'ok':True,'affectedDates':1,'syncQueued':False}
    elif req.resource_type in ('fetch','xhr'):
        STATE['unexpected'].append(req.method+' '+path)
        await route.fulfill(status=400,content_type='application/json',body='{"error":"NO_LOCAL_FIXTURE"}')
        return
    if data is None:
        await route.continue_()
    else:
        STATE['calls'].append({'method':req.method,'path':path,'body':req.post_data_json if req.post_data else None})
        await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))

async def agent(*args):
    proc = await asyncio.create_subprocess_exec(os.environ['AGENT_BROWSER_BIN'],'--cdp','9222','--session','calendar-responsive',*args,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    out,err = await asyncio.wait_for(proc.communicate(),30)
    with (OUT/'agent-browser.log').open('a') as f:
        f.write(' '.join(args)+'\n'+out.decode()+err.decode()+'\n')
    if proc.returncode:
        raise RuntimeError(err.decode() or out.decode())

async def geometry(page, name, width):
    metrics = await page.evaluate('''() => {
      const root=document.querySelector('.pg-calendar-route');
      const main=document.querySelector('.pin-go-app-shell__main');
      const nodes=[...root.querySelectorAll('[class^="pgc-"], [class^="pgs-"], [class^="pgo-"]')];
      const outside=nodes.filter(el=>{const b=el.getBoundingClientRect();return b.width>0 && b.height>0 && (b.left < -1 || b.right > innerWidth+1);}).map(el=>({class:el.className,text:el.textContent.slice(0,45),right:el.getBoundingClientRect().right}));
      const clipping=[document.documentElement,document.body,main,root].some(el=>['hidden','clip'].includes(getComputedStyle(el).overflowX));
      const smallInputs=[...root.querySelectorAll('input:not([type="checkbox"]),select')].filter(el=>el.getClientRects().length && (parseFloat(getComputedStyle(el).fontSize)<16 || el.getBoundingClientRect().height<44)).length;
      const smallButtons=[...root.querySelectorAll('button')].filter(el=>el.getClientRects().length && el.getBoundingClientRect().height<44).map(el=>el.textContent);
      return {viewport:innerWidth,width:document.documentElement.scrollWidth,mainWidth:main.clientWidth,mainScroll:main.scrollWidth,outside,clipping,smallInputs,smallButtons};
    }''')
    RESULTS.append({'case':name,**metrics,'passed':metrics['width']<=width+1 and metrics['mainScroll']<=metrics['mainWidth']+1 and not metrics['outside'] and not metrics['clipping']})
    assert RESULTS[-1]['passed'],json.dumps(RESULTS[-1])
    if width <= 720:
        assert not metrics['smallInputs'] and not metrics['smallButtons'],metrics
    assert await page.locator('.pgc-calendarGrid').evaluate('(el)=>el.getBoundingClientRect().top < document.querySelector(".pgc-missionControlCard").getBoundingClientRect().top')

async def exercise(page, browser_name):
    page.set_default_timeout(12000)
    page.on('pageerror', lambda e: STATE['errors'].append(str(e)))
    page.on('console', lambda m: STATE['console'].append(m.text) if m.type=='error' else None)
    await page.clock.set_fixed_time(datetime(2026,10,15,12,tzinfo=timezone.utc))
    await page.goto(URL)
    await page.locator('.pgo-heading').wait_for()
    for width,height in [(320,780),(360,800),(390,844),(430,932),(720,900),(768,1024),(844,390),(1024,768),(1440,1000),(1920,1080)]:
        await page.set_viewport_size({'width':width,'height':height})
        await page.wait_for_timeout(60)
        await geometry(page,f'{browser_name} full route {width}x{height}',width)
        if width in (390,1440):
            await page.screenshot(path=str(OUT/f'{browser_name}-{width}-page.png'),full_page=True)
            await page.locator('.pgc-calendarGrid').screenshot(path=str(OUT/f'{browser_name}-{width}-calendar.png'))
    await page.set_viewport_size({'width':390,'height':844})
    await page.locator('[data-calendar-date="2026-10-20"]').click()
    await page.locator('[data-calendar-date="2026-10-21"]').click()
    await page.locator('.pgc-rangeActionPanel').wait_for()
    await geometry(page,f'{browser_name} selected range',390)
    await page.get_by_role('button',name='Manual Rate',exact=True).click()
    await page.get_by_placeholder('199.00').fill('250')
    await geometry(page,f'{browser_name} manual rate form',390)
    await page.get_by_role('button',name='Create Reservation',exact=True).click()
    await page.get_by_placeholder('Guest name',exact=True).fill('LOCAL long guest name')
    await page.get_by_placeholder('Guest email',exact=True).fill('local@example.invalid')
    await geometry(page,f'{browser_name} manual reservation form',390)
    await page.locator('.pgc-rangeActionPanel').screenshot(path=str(OUT/f'{browser_name}-range-forms.png'))
    await page.get_by_role('button',name='Clear',exact=True).click()
    await page.locator('.pgc-iconButton').last.click()
    await expect(page.locator('.pgc-monthTitle')).to_contain_text('November')
    await page.locator('.pgc-iconButton').first.click()
    await expect(page.locator('.pgc-monthTitle')).to_contain_text('October')
    await page.locator('[data-calendar-date="2026-10-20"]').press('Enter')
    await expect(page.locator('[data-calendar-date="2026-10-20"]')).to_have_attribute('aria-pressed','true')
    await page.get_by_role('button',name='Clear',exact=True).click()
    await page.get_by_label('Start Date',exact=True).fill('2026-10-20')
    await page.get_by_label('End Date',exact=True).fill('2026-10-21')
    await page.get_by_label('Minimum Nights',exact=True).fill('3')
    await page.locator('.pgs-button').click()
    assert STATE['calls'][-1]['method']=='PUT'
    await page.locator('.pgs-removalSummary').click()
    await page.get_by_label('Remove Minimum Nights',exact=True).check()
    await geometry(page,f'{browser_name} expanded removal controls',390)
    await page.locator('.pgs-panel').screenshot(path=str(OUT/f'{browser_name}-stay-restrictions.png'))
    before = sum(c['method']=='DELETE' for c in STATE['calls'])
    page.once('dialog',lambda dialog: dialog.dismiss())
    await page.locator('.pgs-removeButton').click()
    assert sum(c['method']=='DELETE' for c in STATE['calls'])==before
    page.once('dialog',lambda dialog: dialog.accept())
    await page.locator('.pgs-removeButton').click()
    await expect(page.get_by_role('status')).to_contain_text('Removed from')
    deletion = [c for c in STATE['calls'] if c['method']=='DELETE'][-1]
    assert deletion['body']=={'dateKeys':['2026-10-20','2026-10-21'],'fields':['minimumNights']}
    RESULTS.append({'case':browser_name+' local apply, cancel, remove, keyboard and month controls','passed':True})
    for mode in ('unavailable','legacy'):
        STATE['mode']=mode
        await page.reload()
        await page.get_by_text('Mission Control live state is unavailable.' if mode=='unavailable' else 'Local legacy alert remains visible',exact=True).wait_for()
        await geometry(page,browser_name+' '+mode+' snapshot',390)
    STATE['mode']='live'
    await page.reload()
    await page.locator('.pgo-heading').wait_for()
    await page.get_by_role('button',name='Open navigation',exact=True).click()
    await page.get_by_role('dialog',name='Main navigation',exact=True).wait_for()
    await page.keyboard.press('Escape')
    await expect(page.get_by_role('button',name='Open navigation',exact=True)).to_be_focused()
    RESULTS.append({'case':browser_name+' mobile menu and focus return','passed':True})

async def main():
    global DIST
    server=ThreadingHTTPServer(('127.0.0.1',4173),Static)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    chrome=None
    try:
        async with async_playwright() as pw:
            chrome=await asyncio.create_subprocess_exec(os.environ['CHROME_PATH'],'--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=9222',f"--user-data-dir={os.environ['RUNNER_TEMP']}/calendar-responsive-chrome",'about:blank',stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
            for _ in range(80):
                try:
                    browser=await pw.chromium.connect_over_cdp('http://127.0.0.1:9222')
                    break
                except Exception:
                    await asyncio.sleep(.1)
            else:
                raise RuntimeError('Chromium startup failed')
            context=browser.contexts[0]
            await context.route('**/*',intercept)
            await agent('open',URL)
            await agent('snapshot','-i')
            page=next(p for p in context.pages if '/properties/' in p.url)
            await exercise(page,'chromium')
            await agent('screenshot',str(OUT/'agent-browser-final.png'),'--full')
            # Measure the unmodified production baseline in the same browser.
            DIST=Path(os.environ['BASELINE_DIST'])
            await page.goto(URL+'?baseline=1')
            await page.get_by_role('heading',name='Property Calendar',exact=True).wait_for()
            baseline=await page.evaluate('({viewport:innerWidth,width:document.documentElement.scrollWidth})')
            RESULTS.append({'case':'baseline overflow reproduced at 390','passed':baseline['width']>390,**baseline})
            await page.screenshot(path=str(OUT/'baseline-390.png'),full_page=True)
            DIST=Path.cwd()/'dist'
            await browser.close()
            safari=await pw.webkit.launch()
            safari_context=await safari.new_context(**pw.devices['iPhone 13'],timezone_id='America/Puerto_Rico',service_workers='block')
            await safari_context.route('**/*',intercept)
            await exercise(await safari_context.new_page(),'webkit')
            await safari.close()
            RESULTS.append({'case':'all APIs mocked; no external requests or runtime errors','passed':not STATE['unexpected'] and not STATE['errors'] and not STATE['console'],'unexpected':STATE['unexpected'],'errors':STATE['errors'],'console':STATE['console']})
    except Exception as error:
        RESULTS.append({'case':'runner','passed':False,'error':str(error)})
        try:
            await agent('screenshot',str(OUT/'failure.png'),'--full')
        except Exception:
            pass
    finally:
        report={'commit':os.environ.get('GITHUB_SHA'),'results':RESULTS}
        (OUT/'results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2),flush=True)
        server.shutdown()
        if chrome is not None and chrome.returncode is None:
            chrome.terminate()
            await chrome.wait()
    return bool(RESULTS) and all(r['passed'] for r in RESULTS)

if __name__=='__main__':
    sys.exit(0 if asyncio.run(main()) else 1)
