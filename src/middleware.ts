import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Empêche le clickjacking : la page ne peut pas être chargée dans une iframe
  response.headers.set("X-Frame-Options", "DENY");

  // Empêche le navigateur de deviner le type MIME d'un fichier
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Force HTTPS pendant 1 an, inclut les sous-domaines
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  // Contrôle les infos envoyées dans le header Referer
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Désactive les API navigateur non nécessaires
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  // Content Security Policy : définit les sources autorisées
  // 'self' = uniquement notre domaine
  // unsafe-inline requis pour Next.js (styles inline au hydration)
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requis par Next.js en dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'", // renforce X-Frame-Options
    ].join("; "),
  );

  return response;
}

// Applique le middleware à toutes les routes sauf les fichiers statiques
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
