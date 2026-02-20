import { useEffect, useRef, useState } from 'react';
import type { ValidationResult, GenerationResult, GeneratedFile, DiagramGraph } from '../../diagram';
import { api } from '../../lib/api';

interface Props {
  graph: DiagramGraph;
  onClose: () => void;
}

type Step = 'loading' | 'validation-failed' | 'preview' | 'error';

export default function GenerateModal({ graph, onClose }: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState(false);

  // Animated progress bar while loading
  useEffect(() => {
    if (step !== 'loading') return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + Math.max(0.4, (90 - p) * 0.07);
      });
    }, 120);
    return () => clearInterval(interval);
  }, [step]);

  // Trigger generation — direct fetch, cancelled on unmount (React 18 safe)
  useEffect(() => {
    let cancelled = false;

    api
      .generate({ graph })
      .then((data) => {
        if (cancelled) return;
        setProgress(100);
        setValidation(data.validation);
        if (!data.validation.valid) {
          setStep('validation-failed');
        } else {
          setResult(data.result ?? null);
          setStep('preview');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProgress(100);
        setError(err instanceof Error ? err.message : 'Generation failed');
        setStep('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await api.downloadZip({ graph });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-code.zip';
      a.click();
      URL.revokeObjectURL(url);
      setDownloadToast(true);
      setTimeout(() => setDownloadToast(false), 6000);
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[900px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-gray-200">Generate Code</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {step === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10">
              <div className="text-gray-300 text-sm font-medium">Generating code…</div>
              {/* Progress bar */}
              <div className="w-72 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">{Math.round(progress)}%</div>
            </div>
          )}

          {step === 'error' && (
            <div className="flex-1 p-6">
              <p className="text-red-400 font-semibold mb-2">Generation failed</p>
              <p className="text-sm text-red-300 font-mono">{error}</p>
            </div>
          )}

          {step === 'validation-failed' && validation && (
            <div className="flex-1 p-6 space-y-3 overflow-y-auto">
              <p className="text-red-400 font-semibold">Generation blocked — fix these errors first:</p>
              {validation.errors.map((e, i) => (
                <div key={i} className="text-sm text-red-300">● {e.message}</div>
              ))}
              {validation.warnings.length > 0 && (
                <>
                  <p className="text-yellow-400 font-semibold mt-4">Warnings:</p>
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="text-sm text-yellow-300">● {w.message}</div>
                  ))}
                </>
              )}
            </div>
          )}

          {step === 'preview' && result && (
            <>
              {/* File tree sidebar */}
              <div className="w-64 border-r border-gray-800 overflow-y-auto p-3">
                <div className="text-xs text-gray-400 mb-2 font-semibold">
                  {result.summary.totalFiles} files
                </div>
                {result.files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full text-left text-xs px-2 py-1 rounded truncate ${
                      selectedFile?.path === f.path
                        ? 'bg-blue-900/40 text-blue-300'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                  >
                    {f.path.split('/').pop()}
                    <div className="text-[10px] text-gray-500 truncate">{f.path}</div>
                  </button>
                ))}
              </div>

              {/* Code preview */}
              <div className="flex-1 overflow-y-auto">
                {selectedFile ? (
                  <div className="relative">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-800/50 sticky top-0">
                      <span className="text-xs text-gray-400 font-mono">{selectedFile.path}</span>
                      <button
                        onClick={() => copyToClipboard(selectedFile.content)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="p-4 text-xs text-gray-300 font-mono whitespace-pre overflow-x-auto">
                      {selectedFile.content}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-gray-500 text-sm p-6 h-full">
                    <div>
                      <pre className="text-xs text-gray-500 font-mono mb-4">{result.tree}</pre>
                      <div className="text-center text-gray-400">
                        Select a file to preview, or download the zip.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center">
          {result && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{result.summary.totalFiles} files generated</span>
              <span className="text-gray-700">·</span>
              {[
                { label: 'Commands', value: result.summary.commands },
                { label: 'Queries', value: result.summary.queries },
                { label: 'Events', value: result.summary.events },
                { label: 'Consumers', value: result.summary.consumers },
                { label: 'Behaviors', value: result.summary.behaviors },
                { label: 'Aggregates', value: result.summary.aggregates },
              ]
                .filter((s) => s.value > 0)
                .map((s, i, arr) => (
                  <span key={s.label}>
                    <span className="text-gray-300">{s.value}</span> {s.label}
                    {i < arr.length - 1 && <span className="text-gray-700 ml-3">·</span>}
                  </span>
                ))}
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300">
              Close
            </button>
            {step === 'preview' && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
              >
                {downloading ? 'Downloading…' : 'Download Zip'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Download toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 shadow-2xl text-sm text-gray-200">
          <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v6m0 0l-3-3m3 3l3-3M12 3v9" />
          </svg>
          <div>
            <div className="font-medium">Download complete</div>
            <div className="text-xs text-gray-400">Check your Downloads folder for generated-code.zip</div>
          </div>
          <button
            onClick={() => setDownloadToast(false)}
            className="ml-2 text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
