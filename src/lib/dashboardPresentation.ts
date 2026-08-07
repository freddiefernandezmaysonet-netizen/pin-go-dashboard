export const DASHBOARD_PRESENTATION = Object.freeze({
  /**
   * Legacy PMS surfaces remain implemented for internal compatibility, but
   * they are not part of the host-facing Pin&Go dashboard experience.
   */
  showLegacyPmsUi: false,
});

export function shouldShowLegacyPmsUi() {
  return DASHBOARD_PRESENTATION.showLegacyPmsUi;
}
