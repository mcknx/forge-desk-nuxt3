import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import type { Client, Page as Paged, Task } from '../types/domain'

const OWNER = { email: 'demo@forgedesk.dev', password: 'forge-desk-demo' }
const VIEWER = { email: 'viewer@forgedesk.dev', password: 'forge-desk-demo' }

/**
 * Signing in through the form is itself covered below, so every other journey
 * takes the API route. `page.request` shares the browser context's cookie jar,
 * so the session cookie lands on the page exactly as if the form had run.
 *
 * The cookie is kept and replayed rather than re-authenticating per test: the
 * login route is rate limited to 8 attempts a minute per IP, which a suite that
 * signs in on every test burns through before it finishes.
 */
const sessions = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>()

async function signIn(page: Page, as = OWNER) {
  const cached = sessions.get(as.email)
  if (cached) {
    await page.context().addCookies(cached)
    return
  }
  const response = await page.request.post('/api/auth/login', { data: as })
  expect(response.status(), 'demo credentials should still be valid').toBe(200)
  sessions.set(as.email, await page.context().cookies())
}

/**
 * StatTile renders its label and its value as sibling paragraphs with no ARIA
 * relationship between them, so there is no accessible name to ask for — this
 * walks the one DOM step instead of matching on Tailwind classes.
 */
function statValue(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('xpath=following-sibling::p[1]')
}

/**
 * Every page here is server-rendered first, so its markup is interactive-looking
 * before Vue has attached a single listener. Typing into a filter or submitting
 * a form in that window silently does nothing, so navigation always waits for
 * hydration to settle.
 */
async function open(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/** "3h 30m" / "45m" / "2h" back to minutes, so a figure can be compared to itself later. */
function toMinutes(text: string): number {
  const h = /(\d+)h/.exec(text)
  const m = /(\d+)m/.exec(text)
  return Number(h?.[1] ?? 0) * 60 + Number(m?.[1] ?? 0)
}

test('the landing page renders and its primary CTA reaches the app', async ({ page }) => {
  await open(page, '/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('freelance ops desk')
  await expect(page.getByText('demo@forgedesk.dev').first()).toBeVisible()

  await page.getByRole('link', { name: 'Open the dashboard' }).click()

  // Signed out, the desk hands you to the sign-in gate with a way back.
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('the dashboard bounces a signed-out visitor to login carrying the redirect', async ({ page }) => {
  await open(page, '/dashboard')

  await expect(page).toHaveURL(/\/login\?redirect=/)
  // Read the param rather than matching the raw string: the router decides
  // whether it stays percent-encoded in the address bar, and either is correct.
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
})

test('the demo credentials sign in and the dashboard reports real numbers', async ({ page }) => {
  await open(page, '/login')

  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Password').fill(OWNER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()

  await expect(statValue(page, 'Active clients')).toHaveText(/^\d+$/)
  await expect(statValue(page, 'Open tasks')).toHaveText(/^\d+$/)
  await expect(statValue(page, 'Overdue')).toHaveText(/^\d+$/)
  // Money is formatted, not raw minor units — a leaking 450000 would show here.
  await expect(statValue(page, 'Unbilled work')).toHaveText(/[\d.,]+/)

  expect(Number(await statValue(page, 'Active clients').innerText())).toBeGreaterThan(0)
})

test('a wrong password shows the server’s own message and stays on login', async ({ page }) => {
  await open(page, '/login')

  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Scoped to the form: NuxtRouteAnnouncer is also role="alert".
  // The wording has to come from the API, not a hardcoded string in the page.
  await expect(page.locator('form').getByRole('alert')).toContainText(/wrong email or password/i)
  await expect(page).toHaveURL(/\/login$/)
})

test('searching the client list moves the URL and narrows the table', async ({ page }) => {
  await signIn(page)
  await open(page, '/clients')

  const rows = page.getByRole('row')
  const before = await rows.count()
  expect(before, 'seed should give the table more than one client').toBeGreaterThan(2)

  await page.getByLabel('Search', { exact: true }).fill('northline')

  // A filtered list has to be a link you can send someone — that is the point
  // of holding filter state in the query string.
  await expect(page).toHaveURL(/[?&]q=northline/)
  await expect(rows).toHaveCount(2) // header row + the one match
  await expect(page.getByRole('link', { name: 'Northline Research' })).toBeVisible()
})

test('a client can be created, found in the list, then edited and the change sticks', async ({ page }) => {
  await signIn(page)

  await open(page, '/clients/new')
  await page.getByLabel('Name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill('ada@example.com')
  await page.getByLabel('Company').fill('Analytical Engines')
  await page.getByLabel('Hourly rate').fill('85.50')
  await page.getByRole('button', { name: 'Create client' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeVisible()
  const detailUrl = page.url()
  await expect(page.getByText('$85.50/h')).toBeVisible()

  await open(page, '/clients?q=Ada')
  await expect(page.getByRole('link', { name: 'Ada Lovelace' }).first()).toBeVisible()

  await open(page, detailUrl)
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Company').fill('Analytical Engines Ltd')
  await page.getByLabel('Hourly rate').fill('99.00')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page).toHaveURL(detailUrl)
  // Reload rather than trusting the in-page state: the claim is that the write
  // reached storage, not that the form updated itself.
  await page.reload()
  await expect(page.getByText('Analytical Engines Ltd')).toBeVisible()
  await expect(page.getByText('$99.00/h')).toBeVisible()
})

test('the overdue filter leaves only tasks that are actually late', async ({ page }) => {
  await signIn(page)
  await open(page, '/tasks')

  await page.getByLabel('Overdue only').check()
  await expect(page).toHaveURL(/[?&]overdue=true/)

  // The list groups by urgency, so "every visible row is overdue" is the claim
  // that the Overdue group is the only group and it holds every rendered row.
  const groups = page.getByRole('heading', { level: 2 })
  await expect(groups).toHaveCount(1)
  await expect(groups).toContainText('Overdue')

  const visibleRows = await page.getByRole('listitem').count()
  expect(visibleRows).toBeGreaterThan(0)
  await expect(groups).toContainText(String(visibleRows))
})

test('logging time against a task moves the client’s unbilled figure', async ({ page }) => {
  await signIn(page)

  // Picked from the API rather than hardcoded: the seed shuffles which client
  // owns which task, and this journey only needs any open task.
  const tasks: Paged<Task> = await page.request.get('/api/tasks?status=todo&perPage=1').then((r) => r.json())
  const task = tasks.items[0]!
  expect(task, 'seed should contain at least one open task').toBeTruthy()

  await open(page, `/clients/${task.clientId}`)
  const before = toMinutes(await statValue(page, 'Unbilled').innerText())

  await open(page, `/tasks/${task.id}`)
  await page.getByLabel('Minutes').fill('90')
  await page.getByRole('button', { name: 'Log time' }).click()
  await expect(page.getByText('1h 30m logged')).toBeVisible()

  await open(page, `/clients/${task.clientId}`)
  const after = toMinutes(await statValue(page, 'Unbilled').innerText())
  expect(after - before).toBe(90)
})

test('the read-only account sees no owner actions and is refused server-side', async ({ page }) => {
  await signIn(page, VIEWER)

  const clients: Paged<Client> = await page.request.get('/api/clients?perPage=1').then((r) => r.json())
  const client = clients.items[0]!

  await open(page, `/clients/${client.id}`)
  await expect(page.getByRole('heading', { level: 1, name: client.name })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Invoice unbilled time' })).toHaveCount(0)

  const blocked = await page.goto('/clients/new')
  expect(blocked?.status()).toBe(403)
  await expect(page.getByText('Error 403')).toBeVisible()

  // The hidden button is a courtesy; this is the part that actually holds.
  const rejected = await page.request.post('/api/clients', {
    data: { name: 'Sneaky Ltd', email: 'sneaky@example.com' },
  })
  expect(rejected.status()).toBe(403)
})

test('the health endpoint answers and names the driver serving the request', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)

  const body = await response.json()
  expect(body.ok).toBe(true)
  expect(['postgres', 'memory']).toContain(body.driver)
  expect(body.persistent).toBe(body.driver === 'postgres')
  expect(body.counts.clients).toBeGreaterThan(0)
})
