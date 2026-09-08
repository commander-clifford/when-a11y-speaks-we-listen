// Keep each paragraph's final two words together without replacing its markup.
function preventParagraphOrphans(container = document) {
  for (const paragraph of container.querySelectorAll('p, figcaption, .install-steps > li > span')) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      nodes.push({ node, start: text.length, end: text.length + node.data.length });
      text += node.data;
    }
    const ending = /(\S)(\s+)(?=\S+\s*$)/u.exec(text);
    if (!ending) continue;
    const start = ending.index + ending[1].length;
    const end = start + ending[2].length;
    for (const item of nodes) {
      if (item.end <= start || item.start >= end) continue;
      const from = Math.max(start - item.start, 0);
      const to = Math.min(end - item.start, item.node.data.length);
      item.node.replaceData(from, to - from, item.start <= start ? '\u00a0' : '');
    }
  }
}

preventParagraphOrphans();
