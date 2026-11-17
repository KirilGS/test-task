import { describe, expect, it } from 'vitest'
import { formatFileDate, formatMsk, fromInputValue, toInputValue } from '../datetime'

describe('дата и время по Москве', () => {
  it('показывает момент со смещением как московское время', () => {
    expect(formatMsk('2026-11-16T10:00:00+03:00')).toBe('16.11.2026, 10:00 (МСК)')
  })

  it('переводит всемирное время в московское', () => {
    expect(formatMsk('2026-11-16T07:00:00.000Z')).toBe('16.11.2026, 10:00 (МСК)')
    expect(formatMsk('2026-06-16T07:00:00Z')).toBe('16.06.2026, 10:00 (МСК)')
    expect(formatMsk('2026-11-16T21:00:00Z')).toBe('17.11.2026, 00:00 (МСК)')
  })

  it('готовит значение для поля даты', () => {
    expect(toInputValue('2026-11-16T07:00:00.000Z')).toBe('2026-11-16T10:00')
  })

  it('собирает момент со смещением Москвы', () => {
    expect(fromInputValue('2026-11-16T10:00')).toBe('2026-11-16T10:00:00+03:00')
    expect(fromInputValue('2026-11-16T10:00:30')).toBe('2026-11-16T10:00:30+03:00')
  })

  it('даёт дату для имени файла', () => {
    expect(formatFileDate('2026-11-16T07:00:00.000Z')).toBe('16-11-2026')
  })

  it('не принимает несуществующий день', () => {
    expect(fromInputValue('2026-02-31T10:00')).toBeNull()
    expect(fromInputValue('завтра')).toBeNull()
  })
})
