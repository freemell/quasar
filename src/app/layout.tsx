import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { PrivyErrorBoundary } from "@/components/providers/privy-error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quasar - Share Your BNB Easily on X",
  description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasartip.",
  openGraph: {
    title: "Quasar - Share Your BNB Easily on X",
    description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasartip.",
    url: "https://quasar.tips/",
    siteName: "Quasar",
    images: [
      {
        url: "https://quasar.tips/quasar-logo.png",
        width: 1200,
        height: 630,
        alt: "Quasar tipping platform"
      }
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quasar - Share Your BNB Easily on X",
    description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasartip.",
    images: ["https://quasar.tips/quasar-logo.png"]
  },
  icons: {
    icon: [
      { url: "/quasar-logo.png", rel: "icon", type: "image/png" },
      { url: "/quasar-logo.png", rel: "shortcut icon", type: "image/png" }
    ],
    apple: [
      { url: "/quasar-logo.png", type: "image/png" }
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Quasar",
              "description": "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasartip.",
              "url": "https://quasar.tips/",
              "sameAs": ["https://x.com/Quasartip"]
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PrivyErrorBoundary>
          <PrivyProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </PrivyProvider>
        </PrivyErrorBoundary>
      </body>
    </html>
  );
}
