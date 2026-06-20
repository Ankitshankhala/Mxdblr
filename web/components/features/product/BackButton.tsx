'use client';

/**
 * BackButton — client island for the product detail page; navigates back in
 * history (router.back). Kept separate so the page can stay a Server Component.
 */
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="btn-ghost"
      style={{ marginBottom: 20, padding: '8px 14px', fontSize: 13 }}
    >
      <ArrowLeft size={14} />
      Back
    </button>
  );
}
