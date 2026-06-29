export const DASHBOARD_ONBOARDING_TOUR_EVENT = 'dashboard:onboarding-tour:start'

export function dispatchDashboardOnboardingTourStart() {
  window.dispatchEvent(new CustomEvent(DASHBOARD_ONBOARDING_TOUR_EVENT))
}
