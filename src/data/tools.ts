import { ToolDefinition } from '../types/pdf';

export const TOOLS: ToolDefinition[] = [
  // Organize
  {
    id: 'merge',
    title: 'Merge PDF',
    category: 'organize',
    description: 'Combine multiple PDF files into a single, organized document with drag-and-drop ordering.',
    iconName: 'Layers',
    acceptsMultiple: true,
  },
  {
    id: 'split',
    title: 'Split PDF',
    category: 'organize',
    description: 'Separate one PDF into individual pages or custom page ranges (e.g. 1-3, 4-7) with ZIP download.',
    iconName: 'Split',
  },
  {
    id: 'delete-pages',
    title: 'Delete PDF Pages',
    category: 'organize',
    description: 'Remove unwanted pages or page ranges (e.g. 2, 5, 8-12) from your PDF and save the result.',
    iconName: 'Trash2',
  },
  {
    id: 'extract-pages',
    title: 'Extract Pages',
    category: 'organize',
    description: 'Select specific pages from your PDF and export them as a clean new standalone document.',
    iconName: 'FileSymlink',
  },
  {
    id: 'reorder',
    title: 'Reorder Pages',
    category: 'organize',
    description: 'Visually sort, duplicate, and rearrange pages in any sequence with interactive drag and drop.',
    iconName: 'ArrowUpDown',
  },
  {
    id: 'rotate',
    title: 'Rotate Pages',
    category: 'organize',
    description: 'Rotate individual pages or all pages 90°, 180°, or 270° clockwise or counter-clockwise.',
    iconName: 'RotateCw',
  },

  // Edit & Sign
  {
    id: 'edit',
    title: 'Edit PDF',
    category: 'edit-sign',
    description: 'Add text, whiteout/redact existing content, add images, draw shapes, arrows, and circles.',
    iconName: 'Edit3',
    badge: 'Popular',
  },
  {
    id: 'text',
    title: 'Add Text',
    category: 'edit-sign',
    description: 'Click anywhere to type text with font size, bold, italic, underline, colors, and Hebrew RTL support.',
    iconName: 'Type',
  },
  {
    id: 'annotate',
    title: 'Annotate PDF',
    category: 'edit-sign',
    description: 'Highlight text, freehand draw, underline, add sticky notes, and draw callout shapes.',
    iconName: 'Highlighter',
  },
  {
    id: 'sign',
    title: 'Sign PDF',
    category: 'edit-sign',
    description: 'Draw your signature, type it with realistic script fonts, or upload signature image.',
    iconName: 'PenTool',
    badge: 'Essential',
  },
  {
    id: 'fill',
    title: 'Fill PDF',
    category: 'edit-sign',
    description: 'Fill forms, insert text fields, interactive checkboxes, date stamps, and signature blocks.',
    iconName: 'CheckSquare',
  },

  // Convert
  {
    id: 'pdf-to-img',
    title: 'PDF to JPG / PNG',
    category: 'convert',
    description: 'Convert PDF pages into high-resolution JPG or PNG images. Download individually or as ZIP.',
    iconName: 'Image',
  },
  {
    id: 'img-to-pdf',
    title: 'Images to PDF',
    category: 'convert',
    description: 'Convert JPG, PNG, and WEBP photos to PDF with custom page size, orientation, and margins.',
    iconName: 'FileImage',
    acceptsMultiple: true,
  },

  // Optimize & Header/Footer
  {
    id: 'compress',
    title: 'Compress PDF',
    category: 'optimize',
    description: 'Reduce PDF file size with Low, Medium, or High compression while preserving quality.',
    iconName: 'Minimize2',
  },
  {
    id: 'watermark',
    title: 'Watermark PDF',
    category: 'optimize',
    description: 'Stamp custom text or image watermark with adjustable opacity, angle, position, and page range.',
    iconName: 'Stamp',
  },
  {
    id: 'page-numbers',
    title: 'Add Page Numbers',
    category: 'optimize',
    description: 'Insert customizable page numbers ("Page 1 of 10", "1/10") at top or bottom positions.',
    iconName: 'Hash',
  },

  // Security
  {
    id: 'protect',
    title: 'Encrypt PDF',
    category: 'security',
    description: 'Protect confidential PDF files with a password to restrict unauthorized viewing.',
    iconName: 'Lock',
  },
  {
    id: 'unlock',
    title: 'Unlock PDF',
    category: 'security',
    description: 'Enter your document password to remove password restrictions and export an unlocked copy.',
    iconName: 'Unlock',
  },
  {
    id: 'metadata',
    title: 'PDF Metadata',
    category: 'security',
    description: 'View and update Title, Author, Subject, Keywords, and Creator properties of your PDF.',
    iconName: 'FileText',
  },
];
