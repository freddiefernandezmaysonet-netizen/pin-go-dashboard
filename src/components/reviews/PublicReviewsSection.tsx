import { useEffect, useMemo, useReducer, useState } from "react";
import {
  getPublicReviews,
  type PublicReviewSort,
  type PublicReviewsPayload,
} from "../../api/reviews";
import {
  INITIAL_PUBLIC_REVIEWS_PAGINATION,
  publicReviewsPaginationReducer,
} from "../../lib/publicReviewsPagination";

export type PublicReviewsSummary = {
  total: number;
  overallRating: number;
};

const CATEGORY_LABELS: Record<string, [string, string]> = {
  cleanlinessRating: ["Cleanliness", "Limpieza"],
  accuracyRating: ["Accuracy", "Exactitud"],
  checkInAccessRating: ["Check-in & access", "Check-in y acceso"],
  communicationRating: ["Communication", "Comunicación"],
  locationRating: ["Location", "Ubicación"],
  valueRating: ["Value", "Valor"],
};

export function PublicReviewsSection({
  organizationSlug,
  propertySlug,
  language,
  onSummaryChange,
}: {
  organizationSlug: string;
  propertySlug: string;
  language: "en" | "es";
  onSummaryChange?: (summary: PublicReviewsSummary | null) => void;
}) {
  const [data, setData] = useState<PublicReviewsPayload | null>(null);
  const [pagination, dispatchPagination] = useReducer(
    publicReviewsPaginationReducer,
    INITIAL_PUBLIC_REVIEWS_PAGINATION
  );
  const [sort, setSort] = useState<PublicReviewSort>("RECENT");
  const [loading, setLoading] = useState(true);
  const stayMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: "UTC" }),
    [language]
  );

  useEffect(() => {
    const controller = new AbortController();
    getPublicReviews(
      organizationSlug,
      propertySlug,
      pagination.request.page,
      10,
      sort,
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted) return;

        if (pagination.request.page === 1) {
          const overallRating = Number(result.averages.overallRating);
          onSummaryChange?.(
            result.total > 0 && Number.isFinite(overallRating)
              ? { total: result.total, overallRating }
              : null
          );
        }

        setData((current) =>
          pagination.request.page === 1 || !current
            ? result
            : (() => {
                const existingIds = new Set(
                  current.reviews.map((review) => review.id)
                );
                return {
                  ...result,
                  reviews: [
                    ...current.reviews,
                    ...result.reviews.filter(
                      (review) => !existingIds.has(review.id)
                    ),
                  ],
                };
              })()
        );
        dispatchPagination({ type: "SUCCEEDED", page: result.page });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (pagination.request.page === 1) {
          setData(null);
          onSummaryChange?.(null);
        } else {
          dispatchPagination({
            type: "FAILED",
            message: "LOAD_MORE_FAILED",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    onSummaryChange,
    organizationSlug,
    pagination.request.attempt,
    pagination.request.page,
    propertySlug,
    sort,
  ]);

  if (!data?.total) return null;

  const overall = Number(data.averages.overallRating ?? 0).toFixed(1);
  const hasMore = data.reviews.length < data.total;

  return (
    <section className="pbe-section pbe-reviews" aria-labelledby="pbe-reviews-title">
      <div className="pbe-reviews-heading">
        <div>
          <p className="pbe-kicker">{language === "es" ? "Estadías verificadas" : "Verified stays"}</p>
          <h2 id="pbe-reviews-title">{language === "es" ? "Lo que dicen nuestros huéspedes" : "What our guests are saying"}</h2>
        </div>
        <div className="pbe-review-score" aria-label={language === "es" ? `${overall} de 5, ${data.total} evaluaciones` : `${overall} out of 5, ${data.total} reviews`}>
          <strong>{overall}</strong><span aria-hidden="true">★</span>
          <small>{data.total} {language === "es" ? "evaluaciones" : "reviews"}</small>
        </div>
      </div>
      <label className="pbe-review-sort">
        <span>{language === "es" ? "Ordenar por" : "Sort by"}</span>
        <select
          value={sort}
          disabled={loading}
          onChange={(event) => {
            setLoading(true);
            dispatchPagination({ type: "RESET" });
            setSort(event.target.value as PublicReviewSort);
          }}
        >
          <option value="RECENT">{language === "es" ? "Más recientes" : "Most recent"}</option>
          <option value="HIGHEST">{language === "es" ? "Calificación más alta" : "Highest rated"}</option>
          <option value="LOWEST">{language === "es" ? "Calificación más baja" : "Lowest rated"}</option>
        </select>
      </label>
      <div className="pbe-review-categories">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key}>
            <span>{label[language === "es" ? 1 : 0]}</span>
            <strong>{Number(data.averages[key as keyof typeof data.averages] ?? 0).toFixed(1)}</strong>
          </div>
        ))}
      </div>
      <div className="pbe-review-grid">
        {data.reviews.map((review) => (
          <article key={review.id} className="pbe-review-card">
            <div className="pbe-review-stars">
              <span aria-hidden="true">{"★".repeat(review.overallRating)}</span>
              <span style={visuallyHidden}>{language === "es" ? `${review.overallRating} de 5 estrellas` : `${review.overallRating} out of 5 stars`}</span>
            </div>
            <p>{review.publicComment}</p>
            <footer>
              <strong>{review.guestDisplayName}</strong>
              <span>✓ {language === "es" ? "Estadía verificada" : "Verified stay"} · {stayMonthFormatter.format(new Date(review.stayMonth))}</span>
            </footer>
            {review.response ? (
              <aside>
                <strong>{language === "es" ? "Respuesta del anfitrión" : "Response from the host"}</strong>
                <p>{review.response.body}</p>
              </aside>
            ) : null}
          </article>
        ))}
      </div>
      {pagination.loadMoreError ? (
        <p id="pbe-review-load-error" className="pbe-review-load-error" role="alert">
          {language === "es"
            ? "No pudimos cargar más evaluaciones. Inténtalo nuevamente."
            : "We could not load more reviews. Please try again."}
        </p>
      ) : null}
      {hasMore ? (
        <button
          className="pbe-review-more"
          type="button"
          disabled={loading}
          aria-describedby={pagination.loadMoreError ? "pbe-review-load-error" : undefined}
          onClick={() => {
            setLoading(true);
            dispatchPagination({ type: "REQUEST_NEXT" });
          }}
        >
          {loading
            ? "…"
            : pagination.loadMoreError
              ? language === "es"
                ? "Reintentar evaluaciones"
                : "Retry reviews"
              : language === "es"
                ? "Ver más evaluaciones"
                : "Show more reviews"}
        </button>
      ) : null}
    </section>
  );
}

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};
