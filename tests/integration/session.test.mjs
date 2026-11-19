import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { build, preview } from 'vite'
import { actor,ok,url,publicKey } from './local.mjs'

test('same browser changes authenticated shops without showing the previous directory', async () => {
  const first = await actor(), second = await actor()
  ok(await first.client.from('customers').update({name:'Synthetic First Shop'}).eq('id',first.customer.id))
  ok(await second.client.from('customers').update({name:'Synthetic Second Shop'}).eq('id',second.customer.id))
  const outDir = '.cache/tenant-browser'
  const define = Object.fromEntries(Object.entries({VITE_DATA_MODE:'supabase',VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:publicKey})
    .map(([key,value])=>['import.meta.env.'+key,JSON.stringify(value)]))
  await build({define,build:{outDir},logLevel:'silent'})
  const server = await preview({build:{outDir},preview:{port:37383,host:'127.0.0.1',strictPort:true},logLevel:'silent'})
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({baseURL:'http://127.0.0.1:37383'})
    const page = await context.newPage()
    for (const [shop,name] of [[first,'Synthetic First Shop'],[second,'Synthetic Second Shop']]) {
      await page.goto('/login')
      await page.getByPlaceholder('Email',{exact:true}).fill(shop.email)
      await page.getByPlaceholder('Password',{exact:true}).fill(shop.password)
      await page.getByRole('button',{name:'Sign in',exact:true}).click()
      await page.getByRole('link',{name:'Customers',exact:true}).click()
      await expect(page.getByText(name,{exact:true})).toBeVisible()
      if (shop===second) assert.equal(await page.getByText('Synthetic First Shop',{exact:true}).count(),0)
      await page.getByRole('button',{name:'Sign out'}).click()
      await expect(page.getByRole('heading',{name:'Sign in to PawnTrack'})).toBeVisible()
    }
  } finally {
    await browser.close()
    await new Promise(resolve=>server.httpServer.close(resolve))
  }
})
