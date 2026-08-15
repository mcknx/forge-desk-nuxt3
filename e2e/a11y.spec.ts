import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * A hand-rolled audit rather than axe-core: no new dependency, and the four
 * rules below are the ones this codebase can actually regress — a field that
 * loses its label, an icon that loses its name, a heading level skipped by a
 * new section, a skip link pushed out of first place. Contrast and colour are
 * settled in CSS tokens, not per page, so they are not worth re-checking here.
 */

const OWNER = { email: 'demo@forgedesk.dev', password: 'forge-desk-demo' }

const PAGES = ['/', '/login', '/dashboard', '/clients', '/style-guide']

interface Audit {
  unnamedControls: string[]
  unnamedImages: string[]
  headings: number[]
}

async function auditPage(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

    const describe = (el: Element) => {
      const type = el.getAttribute('type')
      return `${el.tagName.toLowerCase()}${type ? `[type=${type}]` : ''}${el.id ? `#${el.id}` : ''}`
    }

    // The subset of accname resolution that this UI relies on: aria-label,
    // aria-labelledby, label[for], a wrapping label, then title.
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label')?.trim()
      if (label) return label

      const ids = el.getAttribute('aria-labelledby')
      if (ids) {
        const joined = ids
          .split(/\s+/)
          .map((id) => text(document.getElementById(id)))
          .join(' ')
          .trim()
        if (joined) return joined
      }

      if (el.id) {
        const explicit = text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
        if (explicit) return explicit
      }

      const wrapping = text(el.closest('label'))
      if (wrapping) return wrapping

      return el.getAttribute('title')?.trim() ?? ''
    }

    const controls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
    const images = [...document.querySelectorAll('img, [role="img"]')]

    return {
      unnamedControls: controls.filter((el) => !nameOf(el)).map(describe),
      // An empty alt is a valid decorative image; a missing one is not a choice.
      unnamedImages: images
        .filter((el) => (el.tagName === 'IMG' ? !el.hasAttribute('alt') : !nameOf(el)))
        .map(describe),
      headings: [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((el) => Number(el.tagName[1])),
    }
  })
}

// One real login per worker, replayed as a cookie afterwards: the login route
// is rate limited to 8 attempts a minute per IP, and this file alone would spend
// the whole budget signing in before an audit.
let session: Awaited<ReturnType<BrowserContext['cookies']>> | null = null

test.beforeEach(async ({ page }) => {
  // /dashboard is behind auth and an audit of the login redirect proves nothing.
  if (session) {
    await page.context().addCookies(session)
    return
  }
  const response = await page.request.post('/api/auth/login', { data: OWNER })
  expect(response.status()).toBe(200)
  session = await page.context().cookies()
})

for (const path of PAGES) {
  test(`${path} is navigable by name, heading and keyboard`, async ({ page }) => {
    await page.goto(path)
    const audit = await auditPage(page)

    expect(audit.unnamedControls, `${path}: form controls with no accessible name`).toEqual([])
    expect(audit.unnamedImages, `${path}: images with no alt text or accessible name`).toEqual([])

    const h1s = audit.headings.filter((level) => level === 1)
    expect(h1s, `${path}: a page needs exactly one h1`).toHaveLength(1)

    // A heading may go one level deeper than the one before it, never two —
    // that is what makes heading navigation an outline rather than a guess.
    let previous = 0
    for (const level of audit.headings) {
      expect(level, `${path}: heading h${level} follows h${previous}`).toBeLessThanOrEqual(previous + 1)
      previous = level
    }

    await page.keyboard.press('Tab')
    const firstStop = await page.evaluate(() => ({
      href: document.activeElement?.getAttribute('href') ?? null,
      text: (document.activeElement?.textContent ?? '').trim(),
    }))
    expect(firstStop.href, `${path}: the skip link must be the first tab stop`).toBe('#main')
    expect(firstStop.text).toBe('Skip to content')
  })
}

test('the command palette opens, moves and navigates on the keyboard alone', async ({ page }) => {
  await page.goto('/dashboard')
  // The shortcut is a window listener registered on mount, so a keystroke sent
  // before hydration finishes is simply dropped.
  await page.waitForLoadState('networkidle')

  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible()

  // Opening a search dialog without landing focus in the field makes the
  // shortcut useless to anyone not holding a mouse.
  const search = page.getByRole('combobox', { name: 'Search pages and clients' })
  await expect(search).toBeFocused()

  await page.keyboard.press('ArrowDown')
  const clients = page.getByRole('option', { name: /^Clients/ })
  await expect(clients).toHaveAttribute('aria-selected', 'true')
  // The active option has to be announced, which is aria-activedescendant's job.
  await expect(search).toHaveAttribute('aria-activedescendant', String(await clients.getAttribute('id')))

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/clients$/)
  await expect(palette).toBeHidden()

  await page.keyboard.press('Control+k')
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
})

test('the modal traps focus while open and hands it back on escape', async ({ page }) => {
  const clients = await page.request.get('/api/clients?status=active&perPage=1').then((r) => r.json())
  await page.goto(`/clients/${clients.items[0].id}`)
  await page.waitForLoadState('networkidle')

  const trigger = page.getByRole('button', { name: 'Archive', exact: true })
  await trigger.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Archive this client?' })
  await expect(dialog).toBeVisible()

  const close = page.getByRole('button', { name: 'Close dialog' })
  const cancel = dialog.getByRole('button', { name: 'Cancel' })
  const confirm = dialog.getByRole('button', { name: 'Archive client' })

  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(confirm).toBeFocused()

  // Tabbing off the last control wraps back inside instead of walking onto the
  // page behind the overlay, and shift-tab wraps the other way.
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(confirm).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
