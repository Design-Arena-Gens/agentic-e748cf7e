import dynamic from 'next/dynamic';
const Converter = dynamic(() => import('@/components/Converter'), { ssr: false });

export default function Page() {
  return (
    <main className="card">
      <h1 className="title">Animated ? Real Video</h1>
      <p className="subtitle">Convert GIF/WebP/APNG to MP4/WebM locally in your browser.</p>
      <Converter />
      <div className="footer">
        Fully client-side. No uploads. Works on modern browsers.
      </div>
    </main>
  );
}

