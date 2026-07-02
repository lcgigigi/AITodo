export const DASHBOARD_ONBOARDING_TOUR_EVENT = 'dashboard:onboarding-tour:start'
export const DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT =
  'dashboard:onboarding-tour:close-day-preview'

export function dispatchDashboardOnboardingTourStart() {
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_TOUR_EVENT))
}

export function dispatchDashboardOnboardingTourCloseDayPreview() {
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_TOUR_CLOSE_DAY_PREVIEW_EVENT))
}
