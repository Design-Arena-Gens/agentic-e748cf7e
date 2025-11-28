'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type OutputFormat = 'mp4' | 'webm';

const SUPPORTED_TYPES = [
  'image/gif',
  'image/webp',
  'image/apng',
  'video/webm',
  'video/mp4',
  'video/quicktime'
] as const;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loadingCore, setLoadingCore] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string>('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp4');
  const [crf, setCrf] = useState<number>(23); // quality for x264 or vp9
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const ffmpeg = useMemo(() => new FFmpeg(), []);

  useEffect(() => {
    ffmpeg.on('log', ({ message }) => setLog(message));
    ffmpeg.on('progress', ({ progress }) => setProgress(Math.round(progress * 100)));
  }, [ffmpeg]);

  const loadCore = useCallback(async () => {
    if (ready || loadingCore) return;
    setLoadingCore(true);
    try {
      const coreVersion = '0.12.10';
      const base = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${base}/ffmpeg-worker.js`, 'text/javascript')
      });
      setReady(true);
    } finally {
      setLoadingCore(false);
    }
  }, [ffmpeg, ready, loadingCore]);

  const onInput = useCallback((f: File) => {
    if (!SUPPORTED_TYPES.includes(f.type as any)) {
      // accept anyway; ffmpeg may still decode
    }
    setFile(f);
    setOutputUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  const convert = useCallback(async () => {
    if (!file) return;
    await loadCore();
    setProgress(0);
    setOutputUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });

    const inputName = `input${file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''}` || 'input.gif';
    const outputName = `output.${outputFormat}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const commonVideoFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
    // Try preferred encoders first; gracefully fall back if unavailable in the core build
    try {
      if (outputFormat === 'mp4') {
        await ffmpeg.exec([
          '-i', inputName,
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', commonVideoFilter,
          '-r', '30',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', String(crf),
          '-an',
          outputName
        ]);
      } else {
        await ffmpeg.exec([
          '-i', inputName,
          '-vf', commonVideoFilter,
          '-r', '30',
          '-c:v', 'libvpx-vp9',
          '-b:v', '0',
          '-crf', String(Math.max(18, Math.min(42, crf + 4))),
          '-an',
          outputName
        ]);
      }
    } catch {
      // Fallback paths for cores without GPL encoders
      if (outputFormat === 'mp4') {
        await ffmpeg.exec([
          '-i', inputName,
          '-vf', commonVideoFilter,
          '-r', '30',
          '-c:v', 'mpeg4',
          '-q:v', '3',
          '-an',
          outputName
        ]);
      } else {
        await ffmpeg.exec([
          '-i', inputName,
          '-vf', commonVideoFilter,
          '-r', '30',
          '-c:v', 'vp8',
          '-b:v', '1M',
          '-an',
          outputName
        ]);
      }
    }

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    const blob = new Blob([new Uint8Array(data as unknown as ArrayBuffer)], { type: outputFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
    const url = URL.createObjectURL(blob);
    setOutputUrl(url);
    setProgress(100);
  }, [file, crf, ffmpeg, outputFormat, loadCore]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onInput(f);
  }, [onInput]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onInput(f);
  }, [onInput]);

  return (
    <div>
      <div
        className={`uploader ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <p style={{ marginTop: 0, marginBottom: 10 }}><strong>Drag & drop</strong> an animated GIF/WebP/APNG here</p>
        <input id="file" type="file" accept="image/gif,image/webp,image/apng,video/webm,video/mp4,video/quicktime" onChange={onPick} style={{ display: 'none' }} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <label htmlFor="file" className="btn btn-secondary">Choose file</label>
          <button className="btn" onClick={loadCore} disabled={ready || loadingCore}>
            {loadingCore ? 'Loading engine?' : (ready ? 'Engine ready' : 'Preload engine')}
          </button>
        </div>
        {file && (
          <p className="meta" style={{ marginTop: 10 }}>
            Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
          </p>
        )}
      </div>

      <div style={{ height: 16 }} />

      <div className="card" style={{ background: 'transparent', borderColor: 'var(--border)' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <label htmlFor="format"><span className="meta">Output</span></label>
            <select
              id="format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              style={{ background: '#0f172a', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}
            >
              <option value="mp4">MP4 (H.264 or MPEG-4)</option>
              <option value="webm">WebM (VP9/VP8)</option>
            </select>
          </div>

          <div className="row">
            <label htmlFor="crf"><span className="meta">Quality</span></label>
            <input
              id="crf"
              type="range"
              min={18}
              max={35}
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
            />
            <span className="meta">CRF {crf}</span>
          </div>

          <div className="row">
            <button className="btn" disabled={!file || loadingCore} onClick={convert}>
              {progress > 0 && progress < 100 ? `Converting? ${progress}%` : 'Convert'}
            </button>
          </div>
        </div>

        <div style={{ height: 14 }} />
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        {log && <pre className="meta" style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 120, overflow: 'auto' }}>{log}</pre>}
      </div>

      <div style={{ height: 16 }} />

      <div className="row">
        <div className="preview" style={{ flex: '1 1 420px', minHeight: 220, display: 'grid', placeItems: 'center' }}>
          {outputUrl ? (
            <video ref={videoRef} src={outputUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0b1220' }} />
          ) : (
            <span className="meta">Converted video preview will appear here</span>
          )}
        </div>
        <div style={{ flex: '1 1 260px' }}>
          {file && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="meta">Input</div>
              <div><strong>{file.name}</strong></div>
              <div className="meta">{formatBytes(file.size)}</div>
            </div>
          )}
          {outputUrl && (
            <a className="btn" href={outputUrl} download={`converted.${outputFormat}`}>
              Download {outputFormat.toUpperCase()}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

