// Typed dataLayer event helper for the conversion funnel.
// Contract: app pushes an event here -> a GTM trigger matches the event name ->
// GTM forwards it to GA4 -> the GA4 event is marked as a Key Event. Adding or
// removing conversions is a GTM-only change; this file never needs a redeploy.
// Safe to import from 'use client' components: no-op during SSR and outside production.

export type AnalyticsEvent =
  | { event: 'build_submitted'; distro: string; target: string; profile: string }
  | { event: 'build_succeeded' }
  | { event: 'build_failed'; reason: string }
  | { event: 'prebuilt_download'; slug: string; variant: string }
  | { event: 'feedback_submitted' }
  | { event: 'login_completed' }

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return
  window.dataLayer?.push({ ...event })
}
