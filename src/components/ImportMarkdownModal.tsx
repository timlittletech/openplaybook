/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin-only dialog for importing markdown playbooks. Reads .md files locally,
 * runs the shared parser, and persists via the PlaybookContext import path.
 */

import React, { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePlaybook } from '../contexts/PlaybookContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ImportMarkdownModal: React.FC<Props> = ({ open, onClose }) => {
  const { importMarkdown } = usePlaybook();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; titles: string[] } | null>(null);

  if (!open) return null;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const files = await Promise.all(
        Array.from(fileList)
          .filter(f => /\.(md|markdown)$/i.test(f.name))
          .map(async f => ({ name: f.name, content: await f.text() }))
      );
      if (files.length === 0) {
        throw new Error('No .md / .markdown files in the selection.');
      }
      setResult(await importMarkdown(files));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">
              Import Markdown Playbooks
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <Upload className={`w-8 h-8 ${dragOver ? 'text-indigo-500' : 'text-slate-300'}`} />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600">
                Drop .md files here, or click to browse
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                YAML frontmatter + markdown body. One playbook per file.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".md,.markdown"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {busy && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Importing…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700 text-[13px] font-bold mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Imported {result.count} playbook{result.count === 1 ? '' : 's'}
              </div>
              <ul className="space-y-1">
                {result.titles.map(t => (
                  <li key={t} className="flex items-center gap-2 text-[12px] text-slate-600">
                    <FileText className="w-3 h-3 text-slate-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
