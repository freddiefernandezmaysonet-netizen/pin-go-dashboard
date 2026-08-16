/* eslint-disable react-refresh/only-export-components -- Context provider modules intentionally export their matching consumer hook. */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BrandContextRequestError,
  PIN_GO_STANDARD_BRAND_CONTEXT,
  fetchBrandContext,
  type BrandContext,
  type BrandContextRequestErrorCode,
} from "../api/branding";

type BrandLoadStatus = "loading" | "ready" | "unavailable" | "error";

type BrandState = {
  status: BrandLoadStatus;
  brand: BrandContext | null;
  errorCode: BrandContextRequestErrorCode | null;
};

type BrandingContextValue = {
  brand: BrandContext;
  isCustomBrand: boolean;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

const INITIAL_STATE: BrandState = {
  status: "loading",
  brand: null,
  errorCode: null,
};

function isVercelPreviewHostname(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".vercel.app");
}

function FullPageStatus({
  title,
  message,
  canRetry = false,
}: {
  title: string;
  message: string;
  canRetry?: boolean;
}) {
  return (
    <div
      role="status"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
        color: "#111827",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 32,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#ffffff",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800 }}>{title}</div>
        <div
          style={{
            marginTop: 10,
            color: "#6b7280",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {message}
        </div>

        {canRetry ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              minHeight: 42,
              padding: "0 18px",
              border: 0,
              borderRadius: 10,
              background: "#111827",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function applyDocumentBrand(brand: BrandContext) {
  const root = document.documentElement;
  const originalTitle = document.title;
  const originalPrimary = root.style.getPropertyValue(
    "--brand-primary-color"
  );
  const originalOnPrimary = root.style.getPropertyValue(
    "--brand-on-primary-color"
  );
  const existingFavicon = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"]'
  );
  const favicon = existingFavicon ?? document.createElement("link");
  const createdFavicon = !existingFavicon;
  const originalFaviconHref = favicon.getAttribute("href");
  const originalFaviconType = favicon.getAttribute("type");

  if (createdFavicon) {
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  const primaryColor =
    brand.kind === "CUSTOM_BRAND" ? brand.primaryColor : "#2563EB";
  const onPrimaryColor =
    brand.kind === "CUSTOM_BRAND" ? brand.onPrimaryColor : "#FFFFFF";
  const faviconUrl =
    brand.kind === "CUSTOM_BRAND"
      ? brand.faviconUrl
      : "/pinngo-favicon.png";

  document.title = brand.displayName;
  root.style.setProperty("--brand-primary-color", primaryColor);
  root.style.setProperty("--brand-on-primary-color", onPrimaryColor);
  favicon.href = faviconUrl;

  if (brand.kind === "CUSTOM_BRAND") {
    favicon.removeAttribute("type");
  } else {
    favicon.type = "image/png";
  }

  return () => {
    document.title = originalTitle;

    if (originalPrimary) {
      root.style.setProperty("--brand-primary-color", originalPrimary);
    } else {
      root.style.removeProperty("--brand-primary-color");
    }

    if (originalOnPrimary) {
      root.style.setProperty("--brand-on-primary-color", originalOnPrimary);
    } else {
      root.style.removeProperty("--brand-on-primary-color");
    }

    if (createdFavicon) {
      favicon.remove();
      return;
    }

    if (originalFaviconHref === null) {
      favicon.removeAttribute("href");
    } else {
      favicon.setAttribute("href", originalFaviconHref);
    }

    if (originalFaviconType === null) {
      favicon.removeAttribute("type");
    } else {
      favicon.setAttribute("type", originalFaviconType);
    }
  };
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandState>(INITIAL_STATE);

  useEffect(() => {
    const controller = new AbortController();

    fetchBrandContext(controller.signal)
      .then((brand) => {
        setState({ status: "ready", brand, errorCode: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (
          error instanceof BrandContextRequestError &&
          error.code === "BRAND_DOMAIN_UNAVAILABLE" &&
          isVercelPreviewHostname(window.location.hostname)
        ) {
          setState({
            status: "ready",
            brand: PIN_GO_STANDARD_BRAND_CONTEXT,
            errorCode: null,
          });
          return;
        }

        if (
          error instanceof BrandContextRequestError &&
          error.code === "BRAND_DOMAIN_UNAVAILABLE"
        ) {
          setState({
            status: "unavailable",
            brand: null,
            errorCode: error.code,
          });
          return;
        }

        setState({
          status: "error",
          brand: null,
          errorCode:
            error instanceof BrandContextRequestError ? error.code : null,
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!state.brand) return;
    return applyDocumentBrand(state.brand);
  }, [state.brand]);

  const value = useMemo<BrandingContextValue | null>(() => {
    if (!state.brand) return null;
    return {
      brand: state.brand,
      isCustomBrand: state.brand.kind === "CUSTOM_BRAND",
    };
  }, [state.brand]);

  if (state.status === "loading") {
    return (
      <FullPageStatus
        title="Loading dashboard"
        message="Preparing your secure workspace..."
      />
    );
  }

  if (state.status === "unavailable") {
    return (
      <FullPageStatus
        title="Dashboard unavailable"
        message="This domain is not currently connected to an active dashboard."
      />
    );
  }

  if (state.status === "error" || !value) {
    return (
      <FullPageStatus
        title="Unable to load dashboard"
        message="The dashboard identity could not be verified. Please try again."
        canRetry
      />
    );
  }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBrand must be used inside BrandProvider.");
  }
  return context;
}
