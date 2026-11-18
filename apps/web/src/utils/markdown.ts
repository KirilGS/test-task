import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false })
const allowLink = markdown.validateLink.bind(markdown)

markdown.validateLink = (url: string) => {
  const normalized = url.trim().toLowerCase()
  if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) {
    return false
  }
  return allowLink(url)
}

export function renderDoc(source: string): string {
  return markdown.render(source)
}
