import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Sparkles, Image as ImageIcon } from 'lucide-react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onUseSample?: () => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  isImageMode?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  onUseSample,
  accept = '.pdf,application/pdf',
  multiple = false,
  title,
  subtitle,
  isImageMode = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      if (multiple) {
        onFilesSelected(droppedFiles);
      } else {
        onFilesSelected([droppedFiles[0]]);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onFilesSelected(selected);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 sm:p-12 text-center flex flex-col items-center justify-center ${
        isDragging
          ? 'border-neutral-900 bg-neutral-100/80 scale-[0.99]'
          : 'border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50/50 shadow-sm'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800 mb-4 group-hover:bg-neutral-200 transition-colors">
        {isImageMode ? (
          <ImageIcon className="w-7 h-7 text-neutral-700" />
        ) : (
          <UploadCloud className="w-7 h-7 text-neutral-700" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-neutral-900 mb-1">
        {title || (multiple ? 'Choose PDF files' : 'Choose a PDF file')}
      </h3>
      <p className="text-sm text-neutral-500 max-w-md mb-6">
        {subtitle ||
          (isImageMode
            ? 'Drag & drop JPG, PNG, or WEBP images here, or click to browse'
            : multiple
            ? 'Drag & drop multiple PDF files here, or click to browse from your device'
            : 'Drag & drop your PDF here, or click to select from your device')}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          Select {isImageMode ? 'Images' : multiple ? 'Files' : 'PDF'}
        </button>

        {onUseSample && !isImageMode && (
          <button
            type="button"
            onClick={onUseSample}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Use Sample PDF</span>
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-neutral-400">
        <FileText className="w-3.5 h-3.5" />
        <span>No file size limits · Files never leave your browser</span>
      </div>
    </div>
  );
};
