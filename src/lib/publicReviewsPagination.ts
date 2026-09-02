export type PublicReviewsPaginationState = {
  loadedPage: number;
  request: {
    page: number;
    attempt: number;
  };
  loadMoreError: string;
};

export type PublicReviewsPaginationAction =
  | { type: "RESET" }
  | { type: "REQUEST_NEXT" }
  | { type: "SUCCEEDED"; page: number }
  | { type: "FAILED"; message: string };

export const INITIAL_PUBLIC_REVIEWS_PAGINATION: PublicReviewsPaginationState = {
  loadedPage: 0,
  request: { page: 1, attempt: 0 },
  loadMoreError: "",
};

export function publicReviewsPaginationReducer(
  state: PublicReviewsPaginationState,
  action: PublicReviewsPaginationAction
): PublicReviewsPaginationState {
  switch (action.type) {
    case "RESET":
      return {
        loadedPage: 0,
        request: { page: 1, attempt: state.request.attempt + 1 },
        loadMoreError: "",
      };
    case "REQUEST_NEXT":
      return {
        ...state,
        request: {
          page: Math.max(1, state.loadedPage + 1),
          attempt: state.request.attempt + 1,
        },
        loadMoreError: "",
      };
    case "SUCCEEDED":
      return {
        ...state,
        loadedPage: Math.max(state.loadedPage, action.page),
        loadMoreError: "",
      };
    case "FAILED":
      return {
        ...state,
        loadMoreError: action.message,
      };
  }
}
