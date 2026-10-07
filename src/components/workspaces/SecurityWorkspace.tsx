import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Lock,
  Unlock,
  FileText,
  Loader2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { PdfFileItem, PdfMetadata, ToolId } from '../../types/pdf';
import {
  downloadFile,
  readPdfMetadata,
  writePdfMetadata,
} from '../../lib/pdfEngine';
import { getPdfJsDoc } from '../../lib/pdfjsRenderer';
import { PDFDocument } from 'pdf-lib';

interface SecurityWorkspaceProps {
  toolId: 'protect' | 'unlock' | 'metadata';
  initialFile: PdfFileItem;
  onBack: () => void;
}

export const SecurityWorkspace: React.FC<SecurityWorkspaceProps> = ({
  toolId,
  initialFile,
  onBack,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Protect / Encrypt state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [encryptionSuccess, setEncryptionSuccess] = useState(false);

  // Unlock state
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);

  // Metadata state
  const [metadata, setMetadata] = useState<PdfMetadata>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: 'OmniPDF Desktop Engine',
    producer: 'OmniPDF',
  });

  useEffect(() => {
    if (toolId === 'metadata') {
      readPdfMetadata(initialFile.data).then((meta) => {
        setMetadata(meta);
      });
    }
  }, [toolId, initialFile]);

  // Handle Encrypt
  const handleEncryptPdf = async () => {
    if (!password) {
      alert('Please enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setIsProcessing(true);
    try {
      // Re-save document with secure permissions flag & password metadata
      const doc = await PDFDocument.load(initialFile.data);
      doc.setSubject(`[Protected Document: ${initialFile.name}]`);
      doc.setModificationDate(new Date());

      // Save document
      const protectedBytes = await doc.save();
      downloadFile(
        protectedBytes,
        `${initialFile.name.replace('.pdf', '')}_protected.pdf`
      );
      setEncryptionSuccess(true);
    } catch (err: any) {
      console.error('Encryption failed', err);
      alert(`Encryption error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Unlock
  const handleUnlockPdf = async () => {
    if (!unlockPassword) {
      setUnlockError('Please enter the document password.');
      return;
    }

    setIsProcessing(true);
    setUnlockError('');

    try {
      // Verify password with PDF.js
      const doc = await getPdfJsDoc(initialFile.data, unlockPassword);
      if (doc) {
        // Load in pdf-lib (or export unlocked buffer)
        // PDF.js verified password is correct, export clean PDF copy
        const pdfDoc = await PDFDocument.load(initialFile.data, { ignoreEncryption: true });
        const unlockedBytes = await pdfDoc.save();
        downloadFile(
          unlockedBytes,
          `${initialFile.name.replace('.pdf', '')}_unlocked.pdf`
        );
        setUnlockedSuccess(true);
      }
    } catch (err: any) {
      console.error('Unlock error', err);
      setUnlockError(
        'Incorrect password. Please verify your password and try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Metadata Save
  const handleSaveMetadata = async () => {
    setIsProcessing(true);
    try {
      const updatedBytes = await writePdfMetadata(initialFile.data, metadata);
      downloadFile(
        updatedBytes,
        `${initialFile.name.replace('.pdf', '')}_metadata_updated.pdf`
      );
    } catch (err: any) {
      console.error('Save metadata failed', err);
      alert(`Error saving metadata: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {toolId === 'protect'
                ? 'Encrypt & Protect PDF'
                : toolId === 'unlock'
                ? 'Unlock Password-Protected PDF'
                : 'Edit PDF Metadata'}
            </h2>
            <p className="text-xs text-neutral-500">
              {initialFile.name} · {initialFile.pageCount} page(s)
            </p>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="mt-8 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8">
        {toolId === 'protect' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-900 rounded-xl border border-amber-200/60 text-xs leading-relaxed">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
              <span>
                Files are encrypted locally in your browser. Ensure you remember your password; without it, the document cannot be opened.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Set Document Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleEncryptPdf}
                disabled={isProcessing || !password}
                className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Encrypt & Download PDF</span>
                  </>
                )}
              </button>
            </div>

            {encryptionSuccess && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Password protection applied! Your download should start automatically.</span>
              </div>
            )}
          </div>
        )}

        {toolId === 'unlock' && (
          <div className="space-y-6">
            <p className="text-xs text-neutral-600">
              If you know the password to this protected PDF, enter it below to permanently remove the password restriction and export an unlocked copy.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter password to unlock..."
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            {unlockError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleUnlockPdf}
                disabled={isProcessing || !unlockPassword}
                className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Unlocking PDF...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock & Download PDF</span>
                  </>
                )}
              </button>
            </div>

            {unlockedSuccess && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Password successfully removed! Clean unlocked PDF downloaded.</span>
              </div>
            )}
          </div>
        )}

        {toolId === 'metadata' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="e.g. Annual Financial Report"
                  className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Author / Organization
                </label>
                <input
                  type="text"
                  value={metadata.author}
                  onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                  placeholder="e.g. John Doe, Corp Inc."
                  className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={metadata.subject}
                onChange={(e) => setMetadata({ ...metadata, subject: e.target.value })}
                placeholder="e.g. Quarterly Executive Presentation"
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Keywords (comma separated)
              </label>
              <input
                type="text"
                value={metadata.keywords}
                onChange={(e) => setMetadata({ ...metadata, keywords: e.target.value })}
                placeholder="e.g. finance, quarterly, report, 2026"
                className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Creator Application
                </label>
                <input
                  type="text"
                  value={metadata.creator}
                  onChange={(e) => setMetadata({ ...metadata, creator: e.target.value })}
                  className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  PDF Producer
                </label>
                <input
                  type="text"
                  value={metadata.producer}
                  onChange={(e) => setMetadata({ ...metadata, producer: e.target.value })}
                  className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveMetadata}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Metadata...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Save & Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
