"use client";

import { useStore } from "@/lib/store";

export function WishlistButton({ productId, name, className = "" }: { productId: string; name: string; className?: string }) {
  const { wishlist, toggleWish } = useStore();
  const saved = wishlist.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWish(productId);
      }}
      className={`grid h-10 w-10 place-items-center rounded-full bg-bg/90 text-fg backdrop-blur transition-transform hover:scale-110 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.4 3 5 6.4 5c2 0 3.8 1.1 5.6 3.2C13.8 6.1 15.6 5 17.6 5 21 5 22.9 8.4 21.5 11.7 19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
