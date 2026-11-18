import type { Author } from '@support-summary/core'

const PREFIXES: readonly { prefix: string; author: Author }[] = [
  { prefix: 'сотрудник', author: 'employee' },
  { prefix: 'руководитель', author: 'manager' },
  { prefix: 'курьер', author: 'courier' },
  { prefix: 'получатель', author: 'recipient' },
]

export type ParsedChatLine =
  | { ok: true; author: Author; text: string }
  | { ok: false; line: number; message: string }

function stripQuotes(value: string): string {
  if (value.length < 2) {
    return value
  }
  const open = value[0]
  const close = value[value.length - 1]
  if ((open === '«' && close === '»') || (open === '"' && close === '"')) {
    return value.slice(1, -1).trim()
  }
  return value
}

function matchAuthor(line: string): { author: Author; text: string } {
  const lower = line.toLocaleLowerCase('ru-RU')
  for (const item of PREFIXES) {
    if (!lower.startsWith(item.prefix)) {
      continue
    }
    const rest = line.slice(item.prefix.length)
    const matched = /^\s*:\s*(.*)$/.exec(rest)
    if (matched === null) {
      continue
    }
    const captured = matched[1] ?? ''
    return { author: item.author, text: stripQuotes(captured.trim()).trim() }
  }
  return { author: 'other', text: stripQuotes(line).trim() }
}

export function parseChat(text: string, maxLength = 1000): ParsedChatLine[] {
  const result: ParsedChatLine[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const prepared = stripQuotes(line.trim()).trim()
    if (prepared === '') {
      return
    }
    const parsed = matchAuthor(prepared)
    if (parsed.text === '') {
      return
    }
    if (parsed.text.length > maxLength) {
      result.push({
        ok: false,
        line: lineNumber,
        message: `Строка ${lineNumber} длиннее ${maxLength} знаков`,
      })
      return
    }
    result.push({ ok: true, author: parsed.author, text: parsed.text })
  })
  return result
}
