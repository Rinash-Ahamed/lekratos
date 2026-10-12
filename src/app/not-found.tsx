import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap grid min-h-[70vh] place-items-center py-24 text-center">
      <div>
        <p className="serif text-gradient select-none text-[clamp(7rem,22vw,16rem)] font-bold leading-none tracking-tighter opacity-15">
          404
        </p>
        <h1 className="h-display -mt-10 text-[clamp(2.4rem,6vw,4.5rem)] md:-mt-14">
          Page not found
        </h1>
        <p className="lede mx-auto mt-5">
          This page may have moved, or the piece is no longer available.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href="/shop" className="btn btn-solid">Browse shop</Link>
          <Link href="/" className="btn btn-ghost">Go home</Link>
        </div>
      </div>
    </div>
  );
}
