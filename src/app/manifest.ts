import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "le.kratos", short_name: "le.kratos", start_url: "/", display: "browser", background_color: "#F4ECE0", theme_color: "#F4ECE0", icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }] };
}
