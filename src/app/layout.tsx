/* eslint-disable no-restricted-syntax -- theme CSS and JSON-LD are server-generated constants (JSON-LD is "<"-escaped) and carry the CSP nonce */
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/bodoni-moda";
import "./globals.css";
import { buildThemeCss, TOKENS } from "@/lib/theme";
import { StoreProvider } from "@/lib/store";
import { ConfigProvider } from "@/lib/config-context";
import { getPublicConfig } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import type { PublicConfig } from "@/lib/format";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";

const SITE = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "le.kratos — Wearable art, printed small-batch", template: "%s — le.kratos" },
  description: "le.kratos is an independent T-shirt label. Original artwork and photography, finished as wearable pieces.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "le.kratos", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ color: TOKENS.bg }],
};

const themeCss = buildThemeCss();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const config: PublicConfig = await getPublicConfig().catch(() => ({ flatRate: 0 }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "le.kratos", url: SITE, logo: `${SITE}/brand/logo.png`, ...(config.email ? { email: config.email } : {}) },
      { "@type": "WebSite", name: "le.kratos", url: SITE },
    ],
  };

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body>
        <ConfigProvider value={config}>
          <StoreProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">
              Skip to content
            </a>
            <Header />
            <main id="main">{children}</main>
            <Footer />
            <CartDrawer />
          </StoreProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
