declare module 'kordoc' {
  export function parse(path: string): Promise<{
    success: boolean;
    markdown?: string;
    error?: string;
  }>;

  export function markdownToHwpx(markdown: string): Promise<Buffer | Uint8Array | string>;
}
