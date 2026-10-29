import type { MetadataRoute } from "next";

/** Add to home screen: opens straight into the search, full screen, in the page's own colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hackea: hack IKEA furniture, step by step",
    short_name: "Hackea",
    description: "IKEA furniture assembly in 3D, step by step, read out loud.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#f5f4f0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
