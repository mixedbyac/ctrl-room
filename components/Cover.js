'use client';
import { useEffect, useState } from 'react';
import { makeArt } from '@/lib/art';

/** Generated cover art. Renders as <img>, or as a background on `as="div"`. */
export default function Cover({ seed, size = 480, className, alt = '', as = 'img', children, style }) {
  const [src, setSrc] = useState('');
  useEffect(() => { setSrc(makeArt(seed, size)); }, [seed, size]);
  if (as === 'img') return src ? <img src={src} alt={alt} className={className} style={style} /> : <span className={className} style={{ display: 'block', background: '#1a1a1c', ...style }} />;
  return (
    <div className={className} style={{ ...(src ? { backgroundImage: `url(${src})` } : {}), ...style }}>
      {children}
    </div>
  );
}
