import { useEffect } from "react";

type PublicDocumentLanguage = "en" | "es";

type PublicDocumentMetadataOptions = {
  title: string;
  description: string;
  language: PublicDocumentLanguage;
  fallbackTitle: string;
};

type ManagedElement<T extends HTMLElement> = {
  element: T;
  created: boolean;
  originalValue: string | null;
};

function normalizeDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157).trimEnd()}...`;
}

function ensureMeta(name: string): ManagedElement<HTMLMetaElement> {
  const existing = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  );
  const element = existing ?? document.createElement("meta");
  const created = !existing;

  if (created) {
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  return {
    element,
    created,
    originalValue: element.getAttribute("content"),
  };
}

function ensureCanonical(): ManagedElement<HTMLLinkElement> {
  const existing = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  const element = existing ?? document.createElement("link");
  const created = !existing;

  if (created) {
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  return {
    element,
    created,
    originalValue: element.getAttribute("href"),
  };
}

function restoreManagedElement(
  managed: ManagedElement<HTMLElement>,
  attributeName: string
) {
  if (managed.created) {
    managed.element.remove();
    return;
  }

  if (managed.originalValue === null) {
    managed.element.removeAttribute(attributeName);
  } else {
    managed.element.setAttribute(attributeName, managed.originalValue);
  }
}

export function usePublicDocumentMetadata({
  title,
  description,
  language,
  fallbackTitle,
}: PublicDocumentMetadataOptions) {
  useEffect(() => {
    const root = document.documentElement;
    const originalLanguage = root.getAttribute("lang");
    const descriptionMeta = ensureMeta("description");
    const robotsMeta = ensureMeta("robots");
    const canonicalLink = ensureCanonical();

    document.title = title;
    root.setAttribute("lang", language);
    descriptionMeta.element.setAttribute(
      "content",
      normalizeDescription(description)
    );
    robotsMeta.element.setAttribute("content", "index, follow");
    canonicalLink.element.setAttribute(
      "href",
      `${window.location.origin}${window.location.pathname}`
    );

    return () => {
      document.title = fallbackTitle;

      if (originalLanguage === null) {
        root.removeAttribute("lang");
      } else {
        root.setAttribute("lang", originalLanguage);
      }

      restoreManagedElement(descriptionMeta, "content");
      restoreManagedElement(robotsMeta, "content");
      restoreManagedElement(canonicalLink, "href");
    };
  }, [description, fallbackTitle, language, title]);
}

export function usePublicNoIndex(options: { noReferrer?: boolean } = {}) {
  const noReferrer = options.noReferrer === true;

  useEffect(() => {
    const robotsMeta = ensureMeta("robots");
    const referrerMeta = noReferrer ? ensureMeta("referrer") : null;
    robotsMeta.element.setAttribute(
      "content",
      "noindex, nofollow, noarchive"
    );
    referrerMeta?.element.setAttribute("content", "no-referrer");

    return () => {
      restoreManagedElement(robotsMeta, "content");
      if (referrerMeta) restoreManagedElement(referrerMeta, "content");
    };
  }, [noReferrer]);
}
