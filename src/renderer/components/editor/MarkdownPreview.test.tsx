import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { isMarkdownFile, MarkdownPreview } from './MarkdownPreview'

const MD_PATH = '/home/user/proj/docs/README.md'

describe('isMarkdownFile', () => {
  it('recognizes common markdown extensions', () => {
    for (const name of ['README.md', 'docs.md', 'CHANGELOG.markdown', 'notes.mdown', 'guide.mkd']) {
      expect(isMarkdownFile(name)).toBe(true)
    }
  })

  it('rejects non-markdown files', () => {
    for (const name of ['README.txt', 'code.ts', 'notes.md5', 'archive.tar']) {
      expect(isMarkdownFile(name)).toBe(false)
    }
  })
})

describe('MarkdownPreview', () => {
  const readImageAsDataUrl = vi.fn()

  beforeEach(() => {
    readImageAsDataUrl.mockReset()
    readImageAsDataUrl.mockResolvedValue('data:image/png;base64,AAA')
    vi.stubGlobal('api', { fs: { readImageAsDataUrl } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders markdown into HTML', () => {
    render(<MarkdownPreview content={'# Title\n\nSome **bold** text'} filePath={MD_PATH} />)
    const heading = screen.getByRole('heading', { name: 'Title' })
    expect(heading.tagName).toBe('H1')
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('opens external links via window.open and ignores local links', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <MarkdownPreview
        content={'[ext](https://example.com)\n\n[rel](../other.md)\n\n[anch](#sec)'}
        filePath={MD_PATH}
      />
    )

    fireEvent.click(screen.getByText('ext'))
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank')

    // Relative links must not navigate the app (window.open must not fire)
    fireEvent.click(screen.getByText('rel'))
    expect(openSpy).toHaveBeenCalledTimes(1)

    // Anchors do not open anything either
    fireEvent.click(screen.getByText('anch'))
    expect(openSpy).toHaveBeenCalledTimes(1)
  })

  it('renders fenced code blocks and tables', () => {
    render(
      <MarkdownPreview
        content={'```js\nconst x = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |'}
        filePath={MD_PATH}
      />
    )
    expect(screen.getByText('const x = 1')).toBeTruthy()
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('resolves relative images against the markdown directory', async () => {
    render(
      <MarkdownPreview
        content={'![local](./img/logo.png)\n\n![sibling](../assets/hero.jpg)\n\n![web](https://example.com/remote.png)'}
        filePath={MD_PATH}
      />
    )
    await waitFor(() => {
      expect(readImageAsDataUrl).toHaveBeenCalledWith('/home/user/proj/docs/img/logo.png')
      expect(readImageAsDataUrl).toHaveBeenCalledWith('/home/user/proj/assets/hero.jpg')
    })
    // External images are left untouched
    const web = screen.getByAltText('web')
    expect(web.getAttribute('src')).toBe('https://example.com/remote.png')
  })

  it('follows the dark theme variant for the container background', () => {
    // theme-store defaults to github-dark, so the preview is dark
    const { container } = render(<MarkdownPreview content={'# T'} filePath={MD_PATH} />)
    expect(container.querySelector('.markdown-preview')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-zinc-950')
  })
})
