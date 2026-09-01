const PUBLIC_API_BASE = "https://api.pin-ngo.com";
const METADATA_FETCH_TIMEOUT_MS = 2_500;

type PublicBrandContext = {
  kind?: "PIN_GO_STANDARD" | "CUSTOM_BRAND";
  displayName?: string | null;
  logoUrl?: string | null;
  organizationSlug?: string | null;
  customDomain?: string | null;
};

type PublicProperty = {
  name?: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicDescriptionEs?: string | null;
  publicPhotos?: unknown;
  organization?: {
    name?: string | null;
  } | null;
};

type PublicOrganization = {
  name?: string | null;
  properties?: PublicProperty[] | null;
};

type PublicBookingRoute = {
  organizationSlug: string;
  propertySlug: string | null;
};

type ServerVisibleMetadata = {
  title: string;
  description: string;
  siteName: string;
  canonicalUrl: string;
  canonicalHostname: string | null;
  locale: "en_US" | "es_PR";
  language: "en" | "es";
  imageUrl: string | null;
  imageAlt: string;
  structuredData: Record<string, unknown>;
};

type PublicBookingDiscovery = {
  canonicalHostname: string;
  organizationSlug: string;
  propertySlugs: string[];
};

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function parsePublicBookingRoute(pathname: string): PublicBookingRoute | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "book" || segments.length < 2 || segments.length > 3) {
    return null;
  }

  const organizationSlug = safeDecode(segments[1]);
  const propertySlug = segments[2] ? safeDecode(segments[2]) : null;

  if (!organizationSlug || (segments[2] && !propertySlug)) {
    return null;
  }

  return { organizationSlug, propertySlug };
}

function resolveLanguage(request: Request, url: URL): "en" | "es" {
  const requestedLanguage = url.searchParams.get("lang")?.trim().toLowerCase();
  if (requestedLanguage === "es") return "es";
  if (requestedLanguage === "en") return "en";

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.split(",").some((value) => value.trim().startsWith("es"))
    ? "es"
    : "en";
}

function firstPhoto(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    if (typeof item === "string" && /^https:\/\//i.test(item.trim())) {
      return item.trim();
    }
  }

  return null;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function secureJsonLdImage(value: string | null | undefined): string | null {
  const candidate = value?.trim() || "";
  return /^https:\/\//i.test(candidate) ? candidate : null;
}

function buildPublicStructuredData(params: {
  canonicalUrl: string;
  canonicalCollectionUrl: string;
  siteName: string;
  title: string;
  description: string;
  language: "en" | "es";
  imageUrl: string | null;
  brand: PublicBrandContext | null;
  propertyName?: string;
}): Record<string, unknown> {
  const organizationId = `${params.canonicalCollectionUrl}#organization`;
  const logoUrl = secureJsonLdImage(
    params.brand?.kind === "CUSTOM_BRAND" ? params.brand.logoUrl : null
  );
  const imageUrl = secureJsonLdImage(params.imageUrl);
  const pageId = `${params.canonicalUrl}#webpage`;
  const accommodationId = `${params.canonicalUrl}#accommodation`;

  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: params.siteName,
    url: params.canonicalCollectionUrl,
    ...(logoUrl ? { logo: logoUrl } : {}),
  };

  if (!params.propertyName) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        organization,
        {
          "@type": "CollectionPage",
          "@id": pageId,
          url: params.canonicalUrl,
          name: params.title,
          description: params.description,
          inLanguage: params.language,
          publisher: { "@id": organizationId },
          ...(imageUrl ? { image: imageUrl } : {}),
        },
      ],
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebPage",
        "@id": pageId,
        url: params.canonicalUrl,
        name: params.title,
        description: params.description,
        inLanguage: params.language,
        publisher: { "@id": organizationId },
        mainEntity: { "@id": accommodationId },
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      {
        "@type": "Accommodation",
        "@id": accommodationId,
        url: params.canonicalUrl,
        name: params.propertyName,
        description: params.description,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    ],
  };
}

function serializeStructuredData(value: Record<string, unknown>): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function normalizeCrawlerHostname(value: unknown): string | null {
  const hostname =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!hostname || hostname.length > 253 || hostname.includes("..")) return null;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return null;

  const labels = hostname.split(".");
  if (labels.length < 2) return null;
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-")
    )
  ) {
    return null;
  }

  if (!/[a-z]/.test(labels[labels.length - 1])) return null;
  return hostname;
}

function normalizeDiscoverySlug(value: unknown): string | null {
  const slug = typeof value === "string" ? value.trim() : "";
  if (
    !slug ||
    slug.length > 200 ||
    /[\/\\?#]/.test(slug) ||
    /[\u0000-\u001F\u007F]/.test(slug)
  ) {
    return null;
  }

  return slug;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Metadata source returned ${response.status}`);
  }

  return response.json();
}

async function resolvePublicBookingDiscovery(
  hostname: string
): Promise<PublicBookingDiscovery | null> {
  const requestHostname = normalizeCrawlerHostname(hostname);
  if (!requestHostname) return null;

  const payload = (await fetchJson(
    `${PUBLIC_API_BASE}/api/public-booking/discovery?hostname=${encodeURIComponent(
      requestHostname
    )}`
  )) as {
    ok?: boolean;
    discovery?: {
      canonicalHostname?: unknown;
      organizationSlug?: unknown;
      propertySlugs?: unknown;
    } | null;
  };

  if (!payload.ok || !payload.discovery) return null;

  const canonicalHostname = normalizeCrawlerHostname(
    payload.discovery.canonicalHostname
  );
  const organizationSlug = normalizeDiscoverySlug(
    payload.discovery.organizationSlug
  );
  const rawPropertySlugs = payload.discovery.propertySlugs;

  if (
    !canonicalHostname ||
    canonicalHostname !== requestHostname ||
    !organizationSlug ||
    !Array.isArray(rawPropertySlugs)
  ) {
    return null;
  }

  const propertySlugs = Array.from(
    new Set(
      rawPropertySlugs
        .map((value) => normalizeDiscoverySlug(value))
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  if (propertySlugs.length === 0) return null;

  return {
    canonicalHostname,
    organizationSlug,
    propertySlugs,
  };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildCanonicalBookingUrl(
  discovery: PublicBookingDiscovery,
  propertySlug?: string
): string {
  const collectionUrl = `https://${discovery.canonicalHostname}/book/${encodeURIComponent(
    discovery.organizationSlug
  )}`;

  return propertySlug
    ? `${collectionUrl}/${encodeURIComponent(propertySlug)}`
    : collectionUrl;
}

function buildSitemapXml(discovery: PublicBookingDiscovery): string {
  const urls = [
    buildCanonicalBookingUrl(discovery),
    ...discovery.propertySlugs.map((propertySlug) =>
      buildCanonicalBookingUrl(discovery, propertySlug)
    ),
  ];

  const entries = urls
    .map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
}

async function handleCrawlerEndpoint(
  request: Request,
  url: URL
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const requestHostname = normalizeCrawlerHostname(url.hostname);
  const discovery = requestHostname
    ? await resolvePublicBookingDiscovery(requestHostname).catch(() => null)
    : null;
  const isHead = request.method === "HEAD";

  if (url.pathname === "/robots.txt") {
    let robots = "User-agent: *\nAllow: /\n";

    if (discovery && discovery.canonicalHostname === requestHostname) {
      robots += `Sitemap: https://${discovery.canonicalHostname}/sitemap.xml\n`;
    }

    return new Response(isHead ? null : robots, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control":
          "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
        vary: "Host",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (
    url.pathname !== "/sitemap.xml" ||
    !discovery ||
    discovery.canonicalHostname !== requestHostname
  ) {
    return new Response(isHead ? null : "Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow, noarchive",
        "x-content-type-options": "nosniff",
      },
    });
  }

  const sitemap = buildSitemapXml(discovery);
  return new Response(isHead ? null : sitemap, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      vary: "Host",
      "x-content-type-options": "nosniff",
    },
  });
}

function resolvePublicBrandName(
  brand: PublicBrandContext | null,
  organizationName: string | null | undefined
): string {
  if (brand?.kind === "CUSTOM_BRAND" && brand.displayName?.trim()) {
    return brand.displayName.trim();
  }

  return organizationName?.trim() || "Pin&Go";
}

function resolveFallbackImage(
  brand: PublicBrandContext | null,
  origin: string
): string {
  if (brand?.kind === "CUSTOM_BRAND" && brand.logoUrl?.trim()) {
    return brand.logoUrl.trim();
  }

  return `${origin}/pin-go-logo.png`;
}

function resolvePublishedCustomDomain(
  brand: PublicBrandContext | null,
  organizationSlug: string
): string | null {
  if (brand?.kind !== "CUSTOM_BRAND") return null;

  const brandOrganizationSlug = brand.organizationSlug?.trim().toLowerCase();
  if (brandOrganizationSlug && brandOrganizationSlug !== organizationSlug.toLowerCase()) {
    return null;
  }

  const hostname = brand.customDomain?.trim().toLowerCase();
  if (!hostname || hostname.length > 253 || hostname.includes("..")) return null;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return null;

  const labels = hostname.split(".");
  if (labels.length < 2) return null;
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-")
    )
  ) {
    return null;
  }

  if (!/[a-z]/.test(labels[labels.length - 1])) return null;
  return hostname;
}

function resolveCanonicalTarget(
  brand: PublicBrandContext | null,
  organizationSlug: string,
  url: URL
): { canonicalUrl: string; canonicalHostname: string | null } {
  const canonicalHostname = resolvePublishedCustomDomain(brand, organizationSlug);
  const canonicalOrigin = canonicalHostname
    ? `https://${canonicalHostname}`
    : url.origin;

  return {
    canonicalUrl: `${canonicalOrigin}${url.pathname}`,
    canonicalHostname,
  };
}

async function resolveMetadata(
  request: Request,
  url: URL,
  route: PublicBookingRoute
): Promise<ServerVisibleMetadata | null> {
  const language = resolveLanguage(request, url);
  const locale = language === "es" ? "es_PR" : "en_US";

  const bookingUrl = route.propertySlug
    ? `${PUBLIC_API_BASE}/api/public-booking/${encodeURIComponent(
        route.organizationSlug
      )}/${encodeURIComponent(route.propertySlug)}`
    : `${PUBLIC_API_BASE}/api/public-booking/${encodeURIComponent(
        route.organizationSlug
      )}`;

  const bookingPayload = await fetchJson(bookingUrl);

  if (route.propertySlug) {
    const payload = bookingPayload as {
      ok?: boolean;
      publicBrand?: PublicBrandContext | null;
      property?: PublicProperty;
      item?: PublicProperty;
    };
    const property = payload.property ?? payload.item;

    if (!payload.ok || !property) return null;

    const brand = payload.publicBrand ?? null;
    const canonical = resolveCanonicalTarget(brand, route.organizationSlug, url);
    const siteName = resolvePublicBrandName(brand, property.organization?.name);
    const propertyName = property.publicTitle?.trim() || property.name?.trim();
    if (!propertyName) return null;

    const fallbackDescription =
      language === "es"
        ? `Reserva ${propertyName} directamente con ${siteName} mediante una experiencia segura impulsada por Pin&Go.`
        : `Book ${propertyName} directly with ${siteName} through a secure experience powered by Pin&Go.`;
    const description = normalizeDescription(
      (language === "es"
        ? property.publicDescriptionEs?.trim() || property.publicDescription?.trim()
        : property.publicDescription?.trim() || property.publicDescriptionEs?.trim()) ||
        fallbackDescription
    );
    const imageUrl = firstPhoto(property.publicPhotos) || resolveFallbackImage(brand, url.origin);
    const title = `${propertyName} | ${siteName}`;
    const canonicalCollectionUrl = canonical.canonicalUrl.replace(/\/[^/]+$/, "");

    return {
      title,
      description,
      siteName,
      canonicalUrl: canonical.canonicalUrl,
      canonicalHostname: canonical.canonicalHostname,
      locale,
      language,
      imageUrl,
      imageAlt: propertyName,
      structuredData: buildPublicStructuredData({
        canonicalUrl: canonical.canonicalUrl,
        canonicalCollectionUrl,
        siteName,
        title,
        description,
        language,
        imageUrl,
        brand,
        propertyName,
      }),
    };
  }

  const payload = bookingPayload as {
    ok?: boolean;
    publicBrand?: PublicBrandContext | null;
    organization?: PublicOrganization;
  };
  const organization = payload.organization;

  if (!payload.ok || !organization) return null;

  const brand = payload.publicBrand ?? null;
  const canonical = resolveCanonicalTarget(brand, route.organizationSlug, url);
  const siteName = resolvePublicBrandName(brand, organization.name);
  const title =
    language === "es"
      ? `${siteName} | Reservación directa`
      : `${siteName} | Direct Booking`;
  const description = normalizeDescription(
    language === "es"
      ? `Reserva propiedades seleccionadas directamente con ${siteName} mediante una experiencia segura impulsada por Pin&Go.`
      : `Book selected properties directly with ${siteName} through a secure experience powered by Pin&Go.`
  );
  const imageUrl =
    firstPhoto(organization.properties?.[0]?.publicPhotos) ||
    resolveFallbackImage(brand, url.origin);

  return {
    title,
    description,
    siteName,
    canonicalUrl: canonical.canonicalUrl,
    canonicalHostname: canonical.canonicalHostname,
    locale,
    language,
    imageUrl,
    imageAlt: siteName,
    structuredData: buildPublicStructuredData({
      canonicalUrl: canonical.canonicalUrl,
      canonicalCollectionUrl: canonical.canonicalUrl,
      siteName,
      title,
      description,
      language,
      imageUrl,
      brand,
    }),
  };
}

function buildMetadataMarkup(metadata: ServerVisibleMetadata): string {
  const imageMarkup = metadata.imageUrl
    ? [
        `<meta property="og:image" content="${htmlEscape(metadata.imageUrl)}" />`,
        `<meta property="og:image:alt" content="${htmlEscape(metadata.imageAlt)}" />`,
        `<meta name="twitter:image" content="${htmlEscape(metadata.imageUrl)}" />`,
      ].join("\n    ")
    : "";

  return [
    `<meta name="description" content="${htmlEscape(metadata.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${htmlEscape(metadata.canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${htmlEscape(metadata.title)}" />`,
    `<meta property="og:description" content="${htmlEscape(metadata.description)}" />`,
    `<meta property="og:url" content="${htmlEscape(metadata.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${htmlEscape(metadata.siteName)}" />`,
    `<meta property="og:locale" content="${metadata.locale}" />`,
    imageMarkup,
    `<meta name="twitter:card" content="${metadata.imageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${htmlEscape(metadata.title)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(metadata.description)}" />`,
    `<script type="application/ld+json">${serializeStructuredData(metadata.structuredData)}</script>`,
  ]
    .filter(Boolean)
    .join("\n    ");
}

function injectMetadata(html: string, metadata: ServerVisibleMetadata): string {
  const titleMarkup = `<title>${htmlEscape(metadata.title)}</title>`;
  const withLanguage = html.replace(/<html\b([^>]*)\blang="[^"]*"([^>]*)>/i, `<html$1lang="${metadata.language}"$2>`);
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(withLanguage)
    ? withLanguage.replace(/<title>[\s\S]*?<\/title>/i, titleMarkup)
    : withLanguage.replace(/<head>/i, `<head>\n    ${titleMarkup}`);
  const metadataMarkup = buildMetadataMarkup(metadata);

  return withTitle.replace(/<\/head>/i, `    ${metadataMarkup}\n  </head>`);
}

function buildIndexRequestHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const name of [
    "cookie",
    "authorization",
    "user-agent",
    "x-vercel-protection-bypass",
    "x-vercel-set-bypass-cookie",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

async function fetchStaticIndex(request: Request): Promise<Response> {
  const indexUrl = new URL("/index.html", request.url);
  return fetch(indexUrl, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: buildIndexRequestHeaders(request),
    redirect: "follow",
  });
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml") {
    return handleCrawlerEndpoint(request, url);
  }

  const route = parsePublicBookingRoute(url.pathname);
  const indexPromise = fetchStaticIndex(request);

  if (!route || (request.method !== "GET" && request.method !== "HEAD")) {
    return indexPromise;
  }

  const [indexResponse, metadata] = await Promise.all([
    indexPromise,
    resolveMetadata(request, url, route).catch(() => null),
  ]);

  if (!indexResponse.ok || !metadata) {
    return indexResponse;
  }

  const requestHostname = url.hostname.trim().toLowerCase();
  if (
    metadata.canonicalHostname &&
    (url.protocol !== "https:" || requestHostname !== metadata.canonicalHostname)
  ) {
    const redirectUrl = new URL(url.toString());
    redirectUrl.protocol = "https:";
    redirectUrl.hostname = metadata.canonicalHostname;
    redirectUrl.port = "";

    return new Response(null, {
      status: 308,
      headers: {
        location: redirectUrl.toString(),
        "cache-control": "public, max-age=0, s-maxage=300",
      },
    });
  }

  if (request.method === "HEAD") {
    return indexResponse;
  }

  const contentType = indexResponse.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    return indexResponse;
  }

  const html = injectMetadata(await indexResponse.text(), metadata);
  const headers = new Headers(indexResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  headers.set("vary", "Accept-Language");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");

  return new Response(html, {
    status: indexResponse.status,
    statusText: indexResponse.statusText,
    headers,
  });
}

export const config = {
  matcher: ["/book/:path*", "/robots.txt", "/sitemap.xml"],
};
