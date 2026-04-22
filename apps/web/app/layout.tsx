import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TopBar } from "@/components/layout/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocRoute — GovIQ",
  description: "Ingest construction and estates documents, extract metadata, file to the canonical register.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%234f8cff'/><path d='M30 30h25a15 15 0 1 1 0 30H40v10h-10zm10 10v20h15a5 5 0 0 0 0-20z' fill='white'/></svg>",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-base text-fg antialiased grid-bg">
        <div className="min-h-screen flex flex-col">
          <TopBar />
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
