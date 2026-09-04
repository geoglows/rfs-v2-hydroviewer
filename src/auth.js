// Auth initializes first: registers the onAuthStateChange listener and
// captures the recovery-URL snapshot before any top-level awaits / Supabase.
// This module must be the first import in main.js.
import {bootstrapAuth} from "@geoglows/geoglows-auth/bootstrap"
import "@geoglows/geoglows-auth/core/sign-in.css"

const listeners = []

export const auth = bootstrapAuth({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  portalUrl: import.meta.env.VITE_PORTAL_URL,
  onAuthChange: state => listeners.forEach(fn => fn(state)),
})

// per-user RFS data lives in the `rfs` schema (see apps.geoglows-db rfs-user-data skill)
export const rfs = auth.supabase.schema("rfs")

export const userId = () => auth.getState().user?.id ?? null

// subscribe to auth state changes; immediately invoked with the current state
export const subscribeAuth = fn => {
  listeners.push(fn)
  fn(auth.getState())
}
