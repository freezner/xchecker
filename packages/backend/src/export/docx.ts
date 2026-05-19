import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, ShadingType, BorderStyle,
  TableBorders, convertInchesToTwip,
} from 'docx';

type DocChild = Paragraph | Table;

function cellBorder() {
  return { style: BorderStyle.NIL, size: 0, color: 'auto' };
}

function sectionDivider(num: string, title: string): Table {
  const mkCell = (text: string, w: number) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 22 })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { fill: '1F3864', type: ShadingType.SOLID },
      width: { size: w, type: WidthType.PERCENTAGE },
      borders: { top: cellBorder(), bottom: cellBorder(), left: cellBorder(), right: cellBorder() },
      margins: {
        top: convertInchesToTwip(0.04),
        bottom: convertInchesToTwip(0.04),
        left: convertInchesToTwip(0.08),
        right: convertInchesToTwip(0.08),
      },
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [new TableRow({ children: [mkCell(num, 8), mkCell(title, 92)] })],
  });
}

function dataTable(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, ri) =>
      new TableRow({
        children: cells.map((text) =>
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text, bold: ri === 0, size: 18 })],
            })],
            shading: ri === 0 ? { fill: 'D9E1F2', type: ShadingType.SOLID } : undefined,
            margins: {
              top: convertInchesToTwip(0.03), bottom: convertInchesToTwip(0.03),
              left: convertInchesToTwip(0.06), right: convertInchesToTwip(0.06),
            },
          }),
        ),
      }),
    ),
  });
}

function parseCells(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

function isSep(line: string) {
  return /^\|[\s\-|:]+\|$/.test(line.trim());
}

export async function markdownToDocx(md: string): Promise<Buffer> {
  const lines = md.split('\n');
  const children: DocChild[] = [];
  let titleDone = false;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    // Section divider: | N | 제목 | + separator
    if (/^\|\s*\d+\s*\|/.test(t) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const cells = parseCells(t);
      children.push(new Paragraph({ text: '' }));
      children.push(sectionDivider(cells[0] ?? '', cells[1] ?? ''));
      children.push(new Paragraph({ text: '' }));
      i += 2;
      continue;
    }

    // Data table block
    if (t.startsWith('|')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isSep(lines[i])) block.push(lines[i].trim());
        i++;
      }
      if (block.length) {
        children.push(dataTable(block.map(parseCells)));
        children.push(new Paragraph({ text: '' }));
      }
      continue;
    }

    if (t.startsWith('### ')) {
      children.push(new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3 }));
      i++; continue;
    }
    if (t.startsWith('## ')) {
      children.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2 }));
      i++; continue;
    }
    if (t.startsWith('# ')) {
      children.push(new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1 }));
      i++; continue;
    }

    // Blank line
    if (!t) { i++; continue; }

    // Document title (first text line)
    if (!titleDone) {
      titleDone = true;
      children.push(new Paragraph({
        children: [new TextRun({ text: t, bold: true, size: 30 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }));
      i++; continue;
    }

    // Date/small annotation line
    if (/^\([\d.\s]+\)$/.test(t) || t === 'xchecker') {
      children.push(new Paragraph({
        children: [new TextRun({ text: t, size: 18, color: '555555' })],
        alignment: AlignmentType.CENTER,
      }));
      i++; continue;
    }

    // Normal paragraph
    children.push(new Paragraph({
      children: [new TextRun({ text: t, size: 20 })],
      spacing: { after: 80 },
    }));
    i++;
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Legacy export kept for compatibility
export async function buildDocx(md: string): Promise<Buffer> {
  return markdownToDocx(md);
}
