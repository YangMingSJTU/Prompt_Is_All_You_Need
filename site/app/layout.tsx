import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Spellbook 魔法书｜让每一次好提示，沉淀成你的能力";
const description =
  "Spellbook 魔法书是本地优先的桌面端提示词与 Agent Skill 管理器，把可复制的提示词与可迁移的多文件技能整理进一个本地工作台。";

function getOrigin(host: string | null, protocol: string | null) {
  const safeHost = host ?? "spellbook.local";
  const safeProtocol = protocol ?? "https";
  return `${safeProtocol}://${safeHost}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const origin = getOrigin(
    headerList.get("x-forwarded-host") ?? headerList.get("host"),
    headerList.get("x-forwarded-proto"),
  );
  const ogImage = `${origin}/og.png`;

  return {
    title,
    description,
    metadataBase: new URL(origin),
    icons: {
      icon: "/app-icon.png",
      shortcut: "/app-icon.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [
        {
          url: ogImage,
          width: 1730,
          height: 909,
          alt: "Spellbook 魔法书——让每一次好提示，沉淀成你的能力",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
