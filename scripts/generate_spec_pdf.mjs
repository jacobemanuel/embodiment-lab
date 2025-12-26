import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const inputPath = process.argv[2] || 'docs/AI-Study-Buddy-System-Spec.md';
const outputPath = process.argv[3] || 'docs/AI-Study-Buddy-System-Spec.pdf';

const markdown = fs.readFileSync(inputPath, 'utf-8');
const doc = new jsPDF({ unit: 'pt', format: 'a4' });

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 54; // 0.75 in
let y = margin;

const lineHeights = {
  h1: 22,
  h2: 18,
  h3: 16,
  body: 14,
  code: 12,
};

const ensureSpace = (height) => {
  if (y + height > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
};

const writeWrappedText = ({ text, fontSize = 10, font = 'helvetica', style = 'normal', indent = 0, extraSpacing = 4 }) => {
  const maxWidth = pageWidth - margin * 2 - indent;
  doc.setFont(font, style);
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line) => {
    ensureSpace(fontSize * 1.4);
    doc.text(line, margin + indent, y);
    y += fontSize * 1.4;
  });
  y += extraSpacing;
};

const writeBullet = (label, text) => {
  const fontSize = 10;
  const indent = 12;
  const labelSpacing = 10;
  const maxWidth = pageWidth - margin * 2 - indent - labelSpacing;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  ensureSpace(fontSize * 1.4);
  doc.text(label, margin + indent, y);
  if (lines.length > 0) {
    doc.text(lines[0], margin + indent + labelSpacing, y);
  }
  y += fontSize * 1.4;
  for (let i = 1; i < lines.length; i += 1) {
    ensureSpace(fontSize * 1.4);
    doc.text(lines[i], margin + indent + labelSpacing, y);
    y += fontSize * 1.4;
  }
  y += 2;
};

const addHorizontalRule = () => {
  ensureSpace(12);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
};

const addCover = () => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('AI Study Buddy', pageWidth / 2, 180, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text('Technical Specification', pageWidth / 2, 210, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Project: P6: AI Study Buddy', pageWidth / 2, 240, { align: 'center' });
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, pageWidth / 2, 260, { align: 'center' });
  doc.text('Repository: /workspaces/embodiment-lab', pageWidth / 2, 280, { align: 'center' });
  doc.addPage();
  y = margin;
};

addCover();

const lines = markdown.split(/\r?\n/);
let inCodeBlock = false;

for (let i = 0; i < lines.length; i += 1) {
  const rawLine = lines[i];
  const line = rawLine.trimEnd();
  const trimmed = line.trim();

  if (trimmed.startsWith('```')) {
    inCodeBlock = !inCodeBlock;
    if (!inCodeBlock) {
      y += 4;
    }
    continue;
  }

  if (inCodeBlock) {
    const text = rawLine.replace(/\t/g, '  ');
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    const maxWidth = pageWidth - margin * 2 - 18;
    const codeLines = doc.splitTextToSize(text, maxWidth);
    if (codeLines.length === 0) {
      ensureSpace(lineHeights.code);
      y += lineHeights.code;
      continue;
    }
    codeLines.forEach((codeLine) => {
      ensureSpace(lineHeights.code);
      doc.text(codeLine, margin + 18, y);
      y += lineHeights.code;
    });
    continue;
  }

  if (trimmed === '') {
    y += 6;
    continue;
  }

  if (trimmed === '---' || trimmed === '***') {
    addHorizontalRule();
    continue;
  }

  if (trimmed.startsWith('# ')) {
    writeWrappedText({ text: trimmed.slice(2), fontSize: 16, style: 'bold', extraSpacing: 6 });
    continue;
  }

  if (trimmed.startsWith('## ')) {
    writeWrappedText({ text: trimmed.slice(3), fontSize: 13, style: 'bold', extraSpacing: 5 });
    continue;
  }

  if (trimmed.startsWith('### ')) {
    writeWrappedText({ text: trimmed.slice(4), fontSize: 11, style: 'bold', extraSpacing: 4 });
    continue;
  }

  const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
  if (bulletMatch) {
    writeBullet('•', bulletMatch[1]);
    continue;
  }

  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    writeBullet(`${numberedMatch[1]}.`, numberedMatch[2]);
    continue;
  }

  if (trimmed.startsWith('> ')) {
    writeWrappedText({ text: trimmed.slice(2), fontSize: 10, style: 'italic', indent: 12, extraSpacing: 4 });
    continue;
  }

  if (trimmed.endsWith(':') && trimmed.length <= 60) {
    writeWrappedText({ text: trimmed, fontSize: 10, style: 'bold', extraSpacing: 3 });
    continue;
  }

  writeWrappedText({ text: trimmed, fontSize: 10, style: 'normal', extraSpacing: 4 });
}

const totalPages = doc.getNumberOfPages();
for (let page = 1; page <= totalPages; page += 1) {
  doc.setPage(page);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
}

const pdfData = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfData));

console.log(`PDF generated: ${outputPath}`);
