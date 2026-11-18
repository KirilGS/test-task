import { describe, expect, it } from 'vitest'
import { renderDoc } from '@/utils/markdown'

describe('renderDoc', () => {
  it('не выполняет HTML из текста', () => {
    const html = renderDoc('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
  })

  it('не делает ссылку, которая запускает код', () => {
    const html = renderDoc('[открыть](javascript:alert)')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('открыть')
  })
})
