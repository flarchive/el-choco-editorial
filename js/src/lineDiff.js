export function lineDiff(before, after) {
  const lines = (value) => value === '' ? [] : value.replace(/\r\n/g, '\n').split('\n');
  const oldLines = lines(before);
  const newLines = lines(after);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]) suffix++;
  const left = oldLines.slice(prefix, oldLines.length - suffix);
  const right = newLines.slice(prefix, newLines.length - suffix);
  const operations = oldLines.slice(0, prefix).map((text) => ({ kind: 'equal', text }));
  const coarse = (left.length + 1) * (right.length + 1) > 400000 || left.length + right.length > 5000;
  if (coarse || !left.length || !right.length) {
    for (const text of left) operations.push({ kind: 'delete', text });
    for (const text of right) operations.push({ kind: 'add', text });
  } else {
    const width = right.length + 1;
    const table = new Uint16Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--) {
      for (let j = right.length - 1; j >= 0; j--) {
        table[i * width + j] = left[i] === right[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        operations.push({ kind: 'equal', text: left[i++] }); j++;
      } else if (j === right.length || (i < left.length && table[(i + 1) * width + j] >= table[i * width + j + 1])) {
        operations.push({ kind: 'delete', text: left[i++] });
      } else {
        operations.push({ kind: 'add', text: right[j++] });
      }
    }
  }
  for (const text of oldLines.slice(oldLines.length - suffix)) operations.push({ kind: 'equal', text });
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  for (const item of operations) {
    item.oldLine = item.kind === 'add' ? null : oldLine++;
    item.newLine = item.kind === 'delete' ? null : newLine++;
    if (item.kind === 'add') added++;
    if (item.kind === 'delete') removed++;
  }
  const compact = [];
  for (let start = 0; start < operations.length;) {
    if (operations[start].kind !== 'equal') {
      compact.push(operations[start++]);
      continue;
    }
    let end = start;
    while (end < operations.length && operations[end].kind === 'equal') end++;
    if (end - start > 8) {
      compact.push(...operations.slice(start, start + 3), { kind: 'skip', count: end - start - 6 }, ...operations.slice(end - 3, end));
    } else {
      compact.push(...operations.slice(start, end));
    }
    start = end;
  }
  return { rows: compact.slice(0, 1000), added, removed, coarse, truncated: compact.length > 1000 };
}
