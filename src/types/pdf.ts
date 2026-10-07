export type ToolId =
  | 'merge'
  | 'split'
  | 'delete-pages'
  | 'extract-pages'
  | 'reorder'
  | 'rotate'
  | 'edit'
  | 'text'
  | 'annotate'
  | 'sign'
  | 'fill'
  | 'compress'
  | 'pdf-to-img'
  | 'img-to-pdf'
  | 'watermark'
  | 'page-numbers'
  | 'protect'
  | 'unlock'
  | 'metadata';

export interface ToolDefinition {
  id: ToolId;
  title: string;
  category: 'organize' | 'edit-sign' | 'convert' | 'optimize' | 'security';
  description: string;
  iconName: string;
  badge?: string;
  acceptsMultiple?: boolean;
}

export interface PdfFileItem {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
  pageCount: number;
  thumbnails?: string[];
  dimensions?: { width: number; height: number }[];
}

export interface PageItem {
  id: string;
  fileId: string;
  fileName: string;
  originalPageIndex: number; // 0-based
  displayPageNumber: number; // 1-based in current flow
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl?: string;
  width: number;
  height: number;
  isDeleted?: boolean;
  isSelected?: boolean;
}

// Annotation & Overlay types for Edit / Annotate / Fill
export type EditorTool =
  | 'select'
  | 'text'
  | 'whiteout'
  | 'draw'
  | 'highlighter'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'signature'
  | 'image'
  | 'form-text'
  | 'form-check'
  | 'form-date'
  | 'sticky';

export interface BaseAnnotation {
  id: string;
  pageIndex: number;
  x: number; // in PDF points
  y: number; // in PDF points (relative to bottom-left or top-left)
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  isRtl?: boolean;
  width?: number;
}

export interface WhiteoutAnnotation extends BaseAnnotation {
  type: 'whiteout';
  width: number;
  height: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: 'drawing';
  points: DrawingPoint[];
  color: string;
  strokeWidth: number;
  opacity: number;
  isHighlighter?: boolean;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'line' | 'arrow';
  width: number;
  height: number;
  endX?: number;
  endY?: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  opacity: number;
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;
  width: number;
  height: number;
  rotation: number;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  dataUrl: string;
  width: number;
  height: number;
}

export interface FormFieldAnnotation extends BaseAnnotation {
  type: 'form-field';
  fieldType: 'text' | 'checkbox' | 'date' | 'signature';
  label: string;
  value: string | boolean;
  width: number;
  height: number;
}

export interface StickyNoteAnnotation extends BaseAnnotation {
  type: 'sticky';
  text: string;
  color: string;
  width: number;
  height: number;
}

export type AnyAnnotation =
  | TextAnnotation
  | WhiteoutAnnotation
  | DrawingAnnotation
  | ShapeAnnotation
  | ImageAnnotation
  | SignatureAnnotation
  | FormFieldAnnotation
  | StickyNoteAnnotation;

export interface WatermarkConfig {
  type: 'text' | 'image';
  text: string;
  imageUrl?: string;
  fontSize: number;
  opacity: number;
  rotation: number; // degrees e.g. 45
  color: string;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  pages: 'all' | 'custom';
  pageRange?: string; // e.g. "1-3, 5"
}

export interface PageNumberConfig {
  format: 'n' | 'page-n' | 'page-n-of-total' | 'n-slash-total';
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  startNumber: number;
  fontSize: number;
  color: string;
  pages: 'all' | 'custom';
  pageRange?: string;
  margin: number;
}

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface ImgToPdfOptions {
  pageSize: 'a4' | 'letter' | 'auto';
  orientation: 'portrait' | 'landscape' | 'auto';
  margin: 'none' | 'small' | 'normal'; // 0, 20, 40 pt
}
