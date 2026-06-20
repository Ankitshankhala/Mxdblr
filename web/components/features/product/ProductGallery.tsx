'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  images: string[];
  productName: string;
  brand: string;
}

export default function ProductGallery({ images, productName, brand }: Props) {
  const [selected, setSelected] = useState(0);

  const hasImages = images.length > 0;
  // Guard against an out-of-range index (e.g. if images change).
  const activeIdx = selected < images.length ? selected : 0;
  const mainSrc = hasImages ? images[activeIdx] : null;

  return (
    <div>
      {/* Main image — driven by the selected thumbnail */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          background: '#EEF0FE',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {mainSrc ? (
          <Image
            key={mainSrc}
            src={mainSrc}
            alt={productName}
            fill
            style={{ objectFit: 'cover' }}
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
              fontWeight: 900,
              color: '#6366F1',
            }}
          >
            {brand.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Thumbnails — click to swap the main image */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.slice(0, 5).map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1} of ${productName}`}
              aria-pressed={activeIdx === i}
              style={{
                width: 64,
                height: 64,
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                border: `2px solid ${activeIdx === i ? '#F47920' : '#E8E4DE'}`,
                cursor: 'pointer',
                background: 'none',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <Image
                src={img}
                alt={`${productName} view ${i + 1}`}
                fill
                style={{ objectFit: 'cover' }}
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
