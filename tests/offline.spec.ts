import { test,expect,chromium } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('remote mode clears the legacy cache and offers no offline financial forms',async ({page,context}) => {
  // Seed v1 before installing the current service worker.
  await page.route('**/sw.js',route=>route.abort())
  await page.goto('http://127.0.0.1:37382/login')
  await page.evaluate(async () => { const c = await caches.open('pawntrack-cache-v1'); await c.put('/rest/v1/payments',new Response('synthetic')) })
  await page.unroute('**/sw.js')
  await page.reload()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(()=>page.evaluate(()=>caches.has('pawntrack-cache-v1'))).toBe(false)
  await context.setOffline(true)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})
  await expect.poll(()=>page.evaluate(()=>navigator.onLine)).toBe(false)
  await expect(page.getByRole('status').filter({hasText:'Reconnect'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Record Payment'})).toHaveCount(0)
  expect(await page.evaluate(async()=>!!await caches.match('/rest/v1/payments'))).toBe(false)
})
test('mobile demo preserves a local change offline and across a browser restart',async () => {
  const profile = await mkdtemp(join(tmpdir(),'pawntrack-browser-'))
  const launch = () => chromium.launchPersistentContext(profile,{viewport:{width:375,height:812},baseURL:'http://127.0.0.1:37381'})
  let context = await launch()
  try {
    let page = await context.newPage()
    await page.goto('/login')
    await page.getByRole('button',{name:/use demo account/i}).click()
    await expect(page.getByRole('heading',{name:'Active Loans'})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await context.setOffline(true)
    await page.getByRole('link',{name:'Customers',exact:true}).click()
    await page.getByRole('button',{name:'Add Customer'}).first().click()
    await page.getByPlaceholder('e.g. Rajesh Kumar').fill('Offline Synthetic')
    await page.getByPlaceholder('9876543210').fill('9876543234')
    await page.getByRole('button',{name:'Save Customer'}).click()
    await expect(page.getByText('Offline Synthetic',{exact:true})).toBeVisible()
    await context.close()
    context = await launch()
    page = await context.newPage()
    await page.goto('/customers')
    await expect(page.getByText('Offline Synthetic',{exact:true})).toBeVisible()
    await page.getByRole('link',{name:'Reports',exact:true}).click()
    for(const format of ['CSV','PDF']) {
      const download = page.waitForEvent('download')
      await page.getByRole('button',{name:'Export '+format}).first().click()
      const file = await download
      expect(file.suggestedFilename()).toBe('loans-portfolio-report.'+format.toLowerCase())
      const stream = await file.createReadStream()
      const parts = []
      for await (const part of stream!) parts.push(part)
      const contents = Buffer.concat(parts).toString()
      if (format==='PDF') expect(contents.startsWith('%PDF-')).toBe(true)
      else expect(contents).toContain('remaining_principal')
    }
    await page.getByRole('button',{name:'Sign out'}).click()
    await page.waitForURL('**/login')
    expect(await page.evaluate(async () => {
      const entries = await Promise.all((await caches.keys()).map(async n=>(await (await caches.open(n)).keys()).map(r=>new URL(r.url).pathname)))
      return entries.flat().filter(p=>!p.startsWith('/assets/') && !['/index.html','/favicon.svg','/manifest.webmanifest','/placeholder.svg'].includes(p))
    })).toEqual([])
  } finally { await context.close() }
})
