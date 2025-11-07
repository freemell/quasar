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
  description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasaronsol.",
  openGraph: {
    title: "Quasar - Share Your BNB Easily on X",
    description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasaronsol.",
    url: "https://quasar.tips/",
    siteName: "Quasar",
    images: [],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quasar - Share Your BNB Easily on X",
    description: "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasaronsol.",
  },
  icons: {
    icon: "/quasar-icon.svg",
    shortcut: "/quasar-icon.svg",
    apple: "/quasar-icon.svg",
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
              "description": "This is Quasar - Share your BNB easily on X and anonymous transactions powered by x402. Send instant BNB tips to any X post with @Quasaronsol.",
              "url": "https://quasar.tips/",
              "sameAs": ["https://x.com/Quasaronsol"]
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
