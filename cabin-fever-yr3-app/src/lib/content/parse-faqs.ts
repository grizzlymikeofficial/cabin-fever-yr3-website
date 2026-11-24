export type Bullet = { label?: string; text: string }
export type Section = {
  heading: string
  intro?: string
  bullets?: Bullet[]
  groups?: { heading: string; bullets: Bullet[] }[]
}

/** Parse our simple faqs.md shape: # title, ## section, optional ### group, intro p, - **label** : text */
export function parseFaqsMd(md: string): { title: string; sections: Section[] } {
  const lines = md.split(/\r?\n/)
  let title = 'faqs'
  const sections: Section[] = []
  let current: Section | null = null
  let currentGroup: { heading: string; bullets: Bullet[] } | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.slice(2).trim()
      continue
    }

    if (line.startsWith('### ')) {
      if (!current) continue
      currentGroup = { heading: line.slice(4).trim(), bullets: [] }
      current.groups ??= []
      current.groups.push(currentGroup)
      continue
    }

    if (line.startsWith('## ')) {
      currentGroup = null
      current = { heading: line.slice(3).trim(), bullets: [] }
      sections.push(current)
      continue
    }

    if (!current) continue

    const labeled = line.match(/^-\s+\*\*(.+?)\*\*\s*:\s*(.+)$/)
    if (labeled) {
      const bullet = { label: labeled[1]!.trim(), text: labeled[2]!.trim() }
      if (currentGroup) currentGroup.bullets.push(bullet)
      else {
        current.bullets ??= []
        current.bullets.push(bullet)
      }
      continue
    }

    if (line.startsWith('- ')) {
      const bullet = { text: line.slice(2).trim() }
      if (currentGroup) currentGroup.bullets.push(bullet)
      else {
        current.bullets ??= []
        current.bullets.push(bullet)
      }
      continue
    }

    // intro = paragraphs before any bullets/groups in the section
    const hasContent =
      (current.bullets?.length ?? 0) > 0 || (current.groups?.length ?? 0) > 0
    if (!hasContent && !currentGroup) {
      current.intro = current.intro ? `${current.intro} ${line}` : line
    }
  }

  return { title, sections }
}
