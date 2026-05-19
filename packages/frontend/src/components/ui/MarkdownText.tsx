import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  const listItems: string[] = [];

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key}`}>
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>,
      );
      listItems.length = 0;
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      flushList(i);
      elements.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      flushList(i);
      elements.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      flushList(i);
      elements.push(<h1 key={i}>{renderInline(line.slice(2))}</h1>);
    } else if (/^[-*] /.test(line)) {
      listItems.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList(i);
    } else {
      flushList(i);
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }
  });
  flushList(lines.length);

  return <div className="markdown-content">{elements}</div>;
}
