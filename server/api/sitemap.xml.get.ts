import { useRepo } from '../utils/repo'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export default defineEventHandler(async (event) => {
  // Origin comes from the request, so preview deploys advertise themselves
  // rather than the production domain.
  const { origin } = getRequestURL(event)
  const repo = await useRepo()

  const [clients, tasks] = await Promise.all([
    repo.clients.list({ status: 'all', sort: 'name', dir: 'asc', page: 1, perPage: 1000 }),
    repo.tasks.list({ status: 'all', priority: 'all', sort: 'title', dir: 'asc', page: 1, perPage: 1000 }),
  ])

  const paths = [
    '/',
    '/clients',
    '/tasks',
    '/invoices',
    '/style-guide',
    ...clients.items.map((c) => `/clients/${c.id}`),
    ...tasks.items.map((t) => `/tasks/${t.id}`),
  ]

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((p) => `  <url><loc>${escape(origin + p)}</loc></url>`),
    '</urlset>',
  ].join('\n')
})
