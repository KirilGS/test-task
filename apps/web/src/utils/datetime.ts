const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const inputPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

type ClockParts = {
  day: string
  month: string
  year: string
  hour: string
  minute: string
}

function clockParts(iso: string): ClockParts | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const found = new Map<string, string>()
  for (const part of dateTimeFormat.formatToParts(date)) {
    if (part.type !== 'literal') {
      found.set(part.type, part.value)
    }
  }
  const day = found.get('day')
  const month = found.get('month')
  const year = found.get('year')
  const hour = found.get('hour')
  const minute = found.get('minute')
  if (
    day === undefined ||
    month === undefined ||
    year === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return null
  }
  return { day, month, year, hour, minute }
}

export function formatMsk(iso: string): string {
  const parts = clockParts(iso)
  if (parts === null) {
    return 'Дата не указана'
  }
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute} (МСК)`
}

export function toInputValue(iso: string): string {
  const parts = clockParts(iso)
  if (parts === null) {
    return ''
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function fromInputValue(value: string): string | null {
  const match = inputPattern.exec(value)
  if (match === null) {
    return null
  }
  const year = match[1]
  const month = match[2]
  const day = match[3]
  const hour = match[4]
  const minute = match[5]
  const second = match[6] ?? '00'
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return null
  }
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const hourNumber = Number(hour)
  const minuteNumber = Number(minute)
  const secondNumber = Number(second)
  const probe = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))
  const calendarMatches =
    probe.getUTCFullYear() === yearNumber &&
    probe.getUTCMonth() === monthNumber - 1 &&
    probe.getUTCDate() === dayNumber
  if (
    !calendarMatches ||
    hourNumber > 23 ||
    minuteNumber > 59 ||
    secondNumber > 59
  ) {
    return null
  }
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`
}
