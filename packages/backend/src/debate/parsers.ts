import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function parsePdf(buffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `${randomUUID()}.pdf`);
  try {
    await writeFile(tmpPath, buffer);
    const { parse } = await import('kordoc');
    const result = await parse(tmpPath);
    if (!result.success) throw new Error(result.error ?? 'PDF 파싱 실패');
    return (result.markdown ?? '').trim();
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function parseExcel(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`[시트: ${sheetName}]\n${csv.trim()}`);
  }
  return parts.join('\n\n');
}

export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}
