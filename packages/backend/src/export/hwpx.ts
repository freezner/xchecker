export async function buildHwpx(md: string): Promise<Buffer> {
  const { markdownToHwpx } = await import('kordoc');
  const hwpx = await markdownToHwpx(md);
  return Buffer.from(hwpx);
}
