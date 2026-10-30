import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  variant?: "horizontal" | "icon" | "full" | "thermal";
  logoSrc?: string;
  businessName?: string;
  className?: string;
}

const DEFAULT_LOGO_PATH = "/brand/logo.svg";

/**
 * Komponen Logo Manga' Travel (design-spec.json > brand.logo).
 * Mendukung logo bawaan maupun logo kustom yang diunggah melalui halaman Pengaturan (/settings).
 */
export function BrandLogo({
  variant = "horizontal",
  logoSrc,
  businessName = "Manga' Travel",
  className,
}: BrandLogoProps) {
  const resolvedLogoSrc = logoSrc?.trim() || DEFAULT_LOGO_PATH;
  const isCustomLogo = resolvedLogoSrc !== DEFAULT_LOGO_PATH;

  if (variant === "icon") {
    return (
      <div
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center",
          className
        )}
        role="img"
        aria-label={businessName}
      >
        <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none">
          <polygon
            points="32,4 60,32 32,60 4,32"
            fill="var(--color-accent-lime-500)"
          />
          <path
            d="M16 37L46 20C48.2 18.8 50.4 19.8 49.8 22L45.8 30.2L51.8 35L48.2 37.5L42.8 34.1L34.5 41.6L36.2 47L32.8 48.8L29.2 43.5L22.6 41L24.4 38L29.8 39.2L36.4 32L19.5 39.6L16 37Z"
            fill="var(--color-primary-600)"
          />
        </svg>
      </div>
    );
  }

  if (variant === "thermal") {
    return (
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center grayscale contrast-125",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedLogoSrc}
          alt={`Logo ${businessName}`}
          className="h-auto max-h-14 max-w-full object-contain"
        />
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={cn("inline-flex flex-col items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedLogoSrc}
          alt={`Logo ${businessName}`}
          className="h-auto max-h-20 w-44 object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      {isCustomLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedLogoSrc}
          alt={`Logo ${businessName}`}
          className="h-8 w-auto max-w-[112px] shrink-0 object-contain"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="h-8 w-8 shrink-0"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="32,4 60,32 32,60 4,32"
            fill="var(--color-accent-lime-500)"
          />
          <path
            d="M16 37L46 20C48.2 18.8 50.4 19.8 49.8 22L45.8 30.2L51.8 35L48.2 37.5L42.8 34.1L34.5 41.6L36.2 47L32.8 48.8L29.2 43.5L22.6 41L24.4 38L29.8 39.2L36.4 32L19.5 39.6L16 37Z"
            fill="var(--color-primary-600)"
          />
        </svg>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold tracking-tight text-primary-800">
          {businessName}
        </span>
        <span className="text-[11px] font-medium text-neutral-500">
          Sistem Transaksi
        </span>
      </div>
    </div>
  );
}
