// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>HustleAI — Your AI Team for Building Side Hustles</title>
        <meta name="description" content="Discover personalized side hustles, generate 30-day business plans, launch landing pages in 60 seconds, and grow your income with an AI team of agents." />
        <meta name="theme-color" content="#000000" />

        {/* ─── PWA Manifest + Icons ─── */}
        <link rel="manifest" href="/manifest.json?v=2" />
        <link rel="icon" type="image/png" href="/assets/images/favicon.png?v=2" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/icon.png?v=2" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/icon.png?v=2" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/icon.png?v=2" />

        {/* ─── Apple PWA Config ─── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HustleAI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="HustleAI" />
        <meta name="format-detection" content="telephone=no" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HustleAI" />
        <meta property="og:title" content="HustleAI — Your AI Team for Building Side Hustles" />
        <meta property="og:description" content="Discover personalized side hustles, generate 30-day business plans, launch landing pages in 60 seconds, and grow your income with an AI team of agents." />
        <meta property="og:url" content="https://hustleai.live" />
        <meta property="og:image" content="https://hustleai.live/assets/images/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="HustleAI — Your AI Team for Building Side Hustles" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="HustleAI — Your AI Team for Building Side Hustles" />
        <meta name="twitter:description" content="Personalized side hustles, 30-day plans, launch-ready landing pages, and an AI team to grow your income." />
        <meta name="twitter:image" content="https://hustleai.live/assets/images/og-image.png" />
        <meta name="twitter:image:alt" content="HustleAI preview" />

        {/* Preconnect to speed up first paint */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              /* Branded loading animation */
              @keyframes hustleShimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
              .hustle-shimmer { background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%); background-size: 1000px 100%; animation: hustleShimmer 1.6s infinite linear; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000",
        }}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[PWA] Service worker registered', reg.scope);
                  }).catch(function(err) {
                    console.warn('[PWA] Service worker failed', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
