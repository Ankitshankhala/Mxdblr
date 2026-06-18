'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  images: string[];
  productName: string;
}

export default function ProductThumbnails({ images, productName }: Props) {
  const [selected, setSelected] = useState(0);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {images.slice(0, 5).map((img, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setSelected(i)}
          style={{
            width: 64,
            height: 64,
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
            border: `2px solid ${selected === i ? '#F47920' : '#E8E4DE'}`,
            cursor: 'pointer',
            background: 'none',
            padding: 0,
            flexShrink: 0,
          }}
          aria-label={`View image ${i + 1} of ${productName}`}
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
  );
}
