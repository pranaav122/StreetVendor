import type { CSSProperties, ReactNode } from "react";
import { tokens } from "@mystreetvendor/design-tokens";
import "./styles.css";
export const metadata = {
  title: "MyStreetVendor administration",
  description: "Operator review and visit support",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = {
    "--page": tokens.color.background,
    "--ink": tokens.color.text,
    "--primary": tokens.color.primary,
    "--surface": tokens.color.surface,
    "--danger": tokens.color.danger,
  } as CSSProperties;
  return (
    <html lang="en" style={theme}>
      <body>{children}</body>
    </html>
  );
}
