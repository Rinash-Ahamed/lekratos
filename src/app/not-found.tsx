import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="eyebrow text-accent-text">404</p>
        <h1 className="h-display mt-4 text-[clamp(2.6rem,7vw,5rem)]">We can&apos;t find that page</h1>
        <p className="lede mx-auto mt-4">It may have moved, or the piece may no longer be available.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/shop" className="btn btn-solid">Shop</Link><Link href="/" className="btn btn-ghost">Home</Link></div>
      </div>
    </div>
  );
}
