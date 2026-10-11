import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 pt-32 text-center">
      <div>
        <p className="display text-[clamp(4rem,14vw,12rem)]">Gone.</p>
        <p className="mt-4 text-muted">That design isn&apos;t available.</p>
        <Link href="/shop" className="btn btn-accent mt-8">Back to shop</Link>
      </div>
    </div>
  );
}
