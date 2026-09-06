import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

function linesFromTextContent(textContent) {
  const items = [...textContent.items].sort((a, b) => {
    const ay = a.transform[5]
    const by = b.transform[5]
    if (Math.abs(ay - by) > 2) return by - ay
    return a.transform[4] - b.transform[4]
  })

  const lineGroups = []
  let currentLine = []
  let currentY = null

  for (const item of items) {
    const y = item.transform[5]
    if (currentY === null || Math.abs(y - currentY) > 2) {
      if (currentLine.length) lineGroups.push(currentLine)
      currentLine = [item]
      currentY = y
    } else {
      currentLine.push(item)
    }
  }
  if (currentLine.length) lineGroups.push(currentLine)

  return lineGroups.map((lineItems) => {
    let text = ''
    let lastEndX = null
    for (const item of lineItems) {
      const x = item.transform[4]
      if (lastEndX !== null) {
        const charWidth = item.str.length > 0 ? item.width / item.str.length : item.width
        if (x - lastEndX > Math.max(charWidth, 1) * 0.4) text += ' '
      }
      text += item.str
      lastEndX = x + (item.width || 0)
    }
    return text.replace(/\s+/g, ' ').trim()
  })
}

export async function extractPdfText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const allLines = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    allLines.push(...linesFromTextContent(textContent))
  }

  return allLines.join('\n')
}
