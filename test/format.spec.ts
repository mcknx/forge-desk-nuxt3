import { describe, expect, it } from 'vitest'
import { hours, initials, money, relativeDate, shortDate, statusLabel } from '../utils/format'

describe('money', () => {
  it('reads the number as minor units', () => {
    expect(money(123_456, 'USD')).toBe('$1,234.56')
    expect(money(0, 'USD')).toBe('$0.00')
    expect(money(1, 'USD')).toBe('$0.01')
    expect(money(-4500, 'USD')).toBe('-$45.00')
  })

  it('formats a non-dollar currency', () => {
    expect(money(1234, 'PHP')).toContain('12.34')
    expect(money(1234, 'EUR')).toContain('12.34')
  })

  it('falls back instead of throwing on a currency code Intl rejects', () => {
    expect(money(1234, 'NOTACURRENCY')).toBe('NOTACURRENCY 12.34')
    expect(() => money(1234, '')).not.toThrow()
  })

  it('caches per currency without mixing symbols up', () => {
    expect(money(100, 'USD')).toBe('$1.00')
    expect(money(100, 'JPY')).not.toBe('$1.00')
    expect(money(100, 'USD')).toBe('$1.00')
  })
})

describe('hours', () => {
  it('formats the whole range the timesheet shows', () => {
    expect(hours(0)).toBe('0m')
    expect(hours(59)).toBe('59m')
    expect(hours(60)).toBe('1h')
    expect(hours(90)).toBe('1h 30m')
    expect(hours(600)).toBe('10h')
  })

  it('keeps the sign on negative totals', () => {
    expect(hours(-90)).toBe('-1h 30m')
    expect(hours(-30)).toBe('-30m')
  })
})

describe('shortDate', () => {
  it('shows an em dash for no date', () => {
    expect(shortDate(null)).toBe('—')
    expect(shortDate('')).toBe('—')
    expect(shortDate('not a date')).toBe('—')
  })

  it('formats an ISO day and a full timestamp the same way', () => {
    expect(shortDate('2026-08-15')).toBe('15 Aug 2026')
    expect(shortDate('2026-08-15T14:00:00.000Z')).toBe('15 Aug 2026')
    expect(shortDate('2026-01-01')).toBe('1 Jan 2026')
  })

  it('does not slip a day on a date-only string', () => {
    // Parsed as UTC midnight on purpose; a local-time parse renders the 14th.
    expect(shortDate('2026-08-15')).not.toBe('14 Aug 2026')
  })
})

describe('relativeDate', () => {
  it('describes the recent past and near future', () => {
    const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
    expect(relativeDate(days(-3))).toBe('3 days ago')
    expect(relativeDate(days(3))).toBe('in 3 days')
    expect(relativeDate(days(-90))).toBe('3 months ago')
    expect(relativeDate(new Date().toISOString())).toBe('now')
  })

  it('returns the em dash for junk rather than "Invalid Date"', () => {
    expect(relativeDate('nope')).toBe('—')
  })
})

describe('initials', () => {
  it('takes one letter from each of the first two words', () => {
    expect(initials('McKeen Asma')).toBe('MA')
    expect(initials('Northline Research Group')).toBe('NR')
  })

  it('handles a single word', () => {
    expect(initials('Prince')).toBe('P')
    expect(initials('kape')).toBe('K')
  })

  it('handles an empty or whitespace-only name', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})

describe('statusLabel', () => {
  it('turns a snake_case status into a sentence', () => {
    expect(statusLabel('in_progress')).toBe('In progress')
    expect(statusLabel('todo')).toBe('Todo')
    expect(statusLabel('done')).toBe('Done')
    expect(statusLabel('')).toBe('')
  })
})
