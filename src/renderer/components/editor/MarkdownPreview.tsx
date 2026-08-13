import { useEffect, useMemo, useState } from 'react'
import { Marked } from 'marked'
import { FileWarning } from 'lucide-react'
import renderMathInElement from 'katex/contrib/auto-render'
import { useThemeStore } from '@/stores/theme-store'
import 'katex/dist/katex.min.css'

interface MarkdownPreviewProps {
  content: string
  /** Absolute path of the markdown file, used to resolve relative image links */
  filePath: string
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'mkdn'])

export function isMarkdownFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MARKDOWN_EXTENSIONS.has(ext)
}

function baseName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1)
}

/**
 * Resolve a relative image src ("./img.png", "../assets/x.png", "/abs/path")
 * against the directory of the markdown file. Returns null for URLs/data URIs
 * (handled by the caller) and for unresolvable paths.
 */
function resolveImagePath(filePath: string, src: string): string | null {
  if (/^(https?:|data:)/i.test(src)) return null
  if (src.startsWith('/')) return src
  const dir = filePath.slice(0, filePath.lastIndexOf('/'))
  const parts = dir.split('/')
  for (const seg of src.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

const PROSE_LIGHT =
  'text-zinc-900 ' +
  '[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:border-b [&_h1]:border-zinc-200 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-900 ' +
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 ' +
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-800 ' +
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-medium [&_h4]:text-zinc-800 ' +
  '[&_p]:mb-3 [&_p]:leading-relaxed ' +
  '[&_ul]:mb-3 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1 ' +
  '[&_ol]:mb-3 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1 ' +
  '[&_li]:leading-relaxed ' +
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_td]:border [&_td]:border-zinc-300 [&_td]:px-3 [&_td]:py-2 ' +
  '[&_th]:border [&_th]:border-zinc-300 [&_th]:bg-zinc-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium ' +
  '[&_a]:text-blue-600 [&_a]:underline ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600 ' +
  '[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded ' +
  '[&_strong]:font-semibold ' +
  '[&_em]:italic ' +
  '[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] ' +
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-zinc-950 [&_pre]:p-4 ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-100 [&_pre_code]:text-xs [&_pre_code]:leading-relaxed'

const PROSE_DARK =
  'text-zinc-300 ' +
  '[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:border-b [&_h1]:border-zinc-800 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-100 ' +
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-100 ' +
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-200 ' +
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-medium [&_h4]:text-zinc-200 ' +
  '[&_p]:mb-3 [&_p]:leading-relaxed ' +
  '[&_ul]:mb-3 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1 ' +
  '[&_ol]:mb-3 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1 ' +
  '[&_li]:leading-relaxed ' +
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 ' +
  '[&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-zinc-200 ' +
  '[&_a]:text-blue-400 [&_a]:underline ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400 ' +
  '[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded ' +
  '[&_strong]:font-semibold [&_strong]:text-zinc-100 ' +
  '[&_em]:italic ' +
  '[&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-zinc-200 ' +
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-zinc-900 [&_pre]:p-4 ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-100 [&_pre_code]:text-xs [&_pre_code]:leading-relaxed'

export function MarkdownPreview({ content, filePath }: MarkdownPreviewProps): React.ReactElement {
  const variant = useThemeStore((s) => s.variant)
  const isDark = variant === 'dark'
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null)

  const html = useMemo(() => {
    try {
      const md = new Marked({ gfm: true, breaks: false })
      // marked's parse() is typed string | Promise<string>; with async:false it
      // always resolves synchronously to a string.
      return md.parse(content, { async: false }) as string
    } catch {
      return null
    }
  }, [content])

  useEffect(() => {
    if (html === null) {
      setRenderedHtml(null)
      return
    }
    let cancelled = false
    const container = document.createElement('div')
    container.innerHTML = html
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    })
    const images = Array.from(container.querySelectorAll('img'))
    void Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute('src') ?? ''
        if (/^(https?:|data:)/i.test(src)) return
        const abs = resolveImagePath(filePath, src)
        if (!abs) return
        try {
          const dataUrl = await window.api.fs.readImageAsDataUrl(abs)
          if (dataUrl && !cancelled) img.setAttribute('src', dataUrl)
        } catch {
          // Broken or unreadable image — keep the original src so the alt text
          // still renders as a broken-image indicator.
        }
      })
    ).then(() => {
      if (!cancelled) setRenderedHtml(container.innerHTML)
    })
    return () => {
      cancelled = true
    }
  }, [html, filePath])

  if (html === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
        <FileWarning size={48} strokeWidth={1} />
        <span className="text-sm">Failed to render Markdown: {baseName(filePath)}</span>
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 overflow-auto ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
      <div className="mx-auto max-w-3xl px-12 py-10">
        <div
          className={`markdown-preview text-sm leading-relaxed ${isDark ? PROSE_DARK : PROSE_LIGHT}`}
          dangerouslySetInnerHTML={{ __html: renderedHtml ?? html }}
          onClick={(e) => {
            const anchor = (e.target as HTMLElement).closest('a')
            if (!anchor) return
            e.preventDefault()
            const href = anchor.getAttribute('href')
            if (!href) return
            if (/^https?:\/\//i.test(href)) {
              // Opening via _blank hits the main-process setWindowOpenHandler,
              // which routes it to the OS browser and denies the window.
              window.open(href, '_blank')
              return
            }
            if (href.startsWith('#')) {
              const id = href.slice(1)
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
            }
            // Relative/local links are intentionally ignored — navigating the
            // app to them would replace the whole UI.
          }}
        />
      </div>
    </div>
  )
}
