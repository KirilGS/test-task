import { describe, expect, it } from 'vitest'
import { parseChat } from '@/utils/parseChat'

describe('parseChat', () => {
  it('узнаёт авторов по слову до двоеточия', () => {
    expect(parseChat('Сотрудник: документы отправил')).toEqual([
      { ok: true, author: 'employee', text: 'документы отправил' },
    ])
    expect(parseChat('  руководитель : согласен')).toEqual([
      { ok: true, author: 'manager', text: 'согласен' },
    ])
    expect(parseChat('курьер: везу')).toEqual([{ ok: true, author: 'courier', text: 'везу' }])
    expect(parseChat('ПОЛУЧАТЕЛЬ: получил')).toEqual([
      { ok: true, author: 'recipient', text: 'получил' },
    ])
    expect(parseChat('Курьер : Задерживаюсь до 13:00')).toEqual([
      { ok: true, author: 'courier', text: 'Задерживаюсь до 13:00' },
    ])
  })

  it('без двоеточия оставляет всю строку и автора «другое»', () => {
    expect(parseChat('Курьер опаздывает')).toEqual([
      { ok: true, author: 'other', text: 'Курьер опаздывает' },
    ])
    expect(parseChat('Просто текст')).toEqual([{ ok: true, author: 'other', text: 'Просто текст' }])
  })

  it('убирает кавычки и пустые строки', () => {
    expect(
      parseChat('Сотрудник: «документы отправил»\n\n"Получатель: уже получил"\nСотрудник: "документы"'),
    ).toEqual([
      { ok: true, author: 'employee', text: 'документы отправил' },
      { ok: true, author: 'recipient', text: 'уже получил' },
      { ok: true, author: 'employee', text: 'документы' },
    ])
  })

  it('не обрезает слишком длинную строку, а возвращает ошибку', () => {
    const text = 'я'.repeat(1001)
    expect(parseChat(`Сотрудник: ${text}`)).toEqual([
      { ok: false, line: 1, message: 'Строка 1 длиннее 1000 знаков' },
    ])
    const raw = `\n${'я'.repeat(11)}`
    expect(parseChat(raw, 10)).toEqual([
      { ok: false, line: 2, message: 'Строка 2 длиннее 10 знаков' },
    ])
    const allowed = 'я'.repeat(1000)
    expect(parseChat(`Сотрудник: ${allowed}`)).toEqual([
      { ok: true, author: 'employee', text: allowed },
    ])
  })
})
