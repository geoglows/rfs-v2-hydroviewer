// src/auth-bootstrap.js
//
// Owns rfs's Supabase Auth integration: a single Supabase client + auth
// adapter, the `<dialog>` sign-in modal, and the auth-action navbar slot.
// Cross-app SSO with apps.geoglows / aquiferx / grace happens automatically
// because they share the same Supabase project and (when proxied through the
// portal) the same origin — Supabase JS persists tokens to localStorage
// keyed by URL.
//
// Imported FIRST in src/main.js. rfs's main.js has no top-level awaits today,
// so the strict ordering of grace's auth-bootstrap (must register the listener
// before zarr awaits start) does not apply here. Keeping the FIRST-import
// convention anyway so future additions of top-level awaits don't silently
// break SSO. The 2-second safety-net timeout backstops the listener.

import {
  bootstrapSession,
  createGeoglowsSupabaseClient,
  createSupabaseAuthAdapter,
  mountSignInModal,
  renderAuthAction,
} from "@aquaveo/geoglows-auth/core"
import "@aquaveo/geoglows-auth/core/sign-in.css"

const SIGN_IN_REQUESTED_EVENT = "geoglows:sign-in-requested"

const supabase = createGeoglowsSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

const authAdapter = createSupabaseAuthAdapter({
  supabase,
  defaultRedirectTo: window.location.origin,
  logoutRedirectTo: window.location.origin,
})

let authState = {
  user: null,
  account: null,
  status: "bootstrapping",
  action: null,
}

function slot() {
  return document.getElementById("auth-action")
}

function renderSlot() {
  const el = slot()
  if (!el) return
  // Surgical: only the slot's innerHTML is replaced. The surrounding
  // .nav-bar-wrapper and <arcgis-map> are left alone — ArcGIS map components
  // and Materialize's dropdown initializations must not be torn down.
  el.innerHTML = renderAuthAction(authState)

  // Re-bind handlers on the freshly-rendered children every time. The
  // renderAuthAction output owns three stable IDs:
  // #geoglowsSignIn / #geoglowsSignOut / #geoglowsAuthActionAvatar.
  document.getElementById("geoglowsSignIn")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent(SIGN_IN_REQUESTED_EVENT))
  })

  document
    .getElementById("geoglowsSignOut")
    ?.addEventListener("click", async () => {
      authState = {...authState, action: "signing_out"}
      renderSlot()
      try {
        await authAdapter.signOutRedirect()
        // signOutRedirect navigates to logoutRedirectTo (window.location.origin)
        // — the page reloads and module state is reset.
      } catch (error) {
        console.error("Sign out failed:", error)
        authState = {...authState, action: null}
        renderSlot()
      }
    })
}

// Mount the sign-in modal once at module load and bridge the navbar event.
const signInModal = mountSignInModal({authAdapter})
window.addEventListener(SIGN_IN_REQUESTED_EVENT, () => signInModal.open())

let initialBootstrapDone = false

function bootstrapSafe(reason) {
  bootstrapSession({
    auth: authAdapter,
    supabase,
    // initialState carries the previous user/account through the
    // transient bootstrapping/loading_profile/loading_account phases on
    // rebootstrap (e.g. tab-focus revalidation), avoiding the avatar →
    // "Signing in…" flicker. null on first bootstrap is the desired
    // default (lib treats it as a fresh start).
    initialState: authState.user
      ? {
          status: authState.status,
          user: authState.user,
          account: authState.account ?? null,
          error: null,
        }
      : null,
    onStateChange: (state) => {
      // bootstrapSession emits { status, user, account, error }. Preserve
      // any locally-tracked action (e.g. "signing_out") across the merge.
      authState = {...state, action: authState.action}
      renderSlot()
    },
  }).catch((error) => {
    console.error(
      `Bootstrap after ${reason} failed:`,
      error instanceof Error ? error.message : error,
    )
  })
}

// INITIAL_SESSION fires after Supabase JS finishes detectSessionInUrl —
// this is the only safe moment to call getSession() and have it reflect
// any OAuth tokens that arrived in the URL hash. SIGNED_IN / SIGNED_OUT
// fire on later changes (modal sign-in, sign-out from any tab).
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION" && !initialBootstrapDone) {
    initialBootstrapDone = true
    bootstrapSafe("INITIAL_SESSION")

    // Strip OAuth callback artifacts so a reload doesn't replay the flow.
    // Supabase's implicit OAuth callback returns tokens in the hash;
    // PKCE returns ?code=&state= in the query. Clean both.
    const hashHasAuth = /(?:^|[#&])access_token=/.test(window.location.hash)
    const search = new URLSearchParams(window.location.search)
    const queryHasAuth = search.has("code") && search.has("state")
    if (hashHasAuth || queryHasAuth) {
      if (queryHasAuth) {
        search.delete("code")
        search.delete("state")
      }
      const cleanedSearch = search.toString()
      const newUrl =
        window.location.pathname + (cleanedSearch ? `?${cleanedSearch}` : "")
      history.replaceState({}, document.title, newUrl)
    }
    return
  }
  if (event === "SIGNED_OUT") {
    bootstrapSafe("SIGNED_OUT")
    return
  }
  if (event === "SIGNED_IN") {
    // Supabase JS fires SIGNED_IN on every visibility-change session
    // revalidation (GoTrueClient.js _recoverAndRefresh). If it's the
    // same user we already have, skip the rebootstrap — saves a
    // network round trip (and defensively avoids any avatar flicker).
    const newId = session?.user?.id
    const currentSub = authState.user?.sub
    if (newId && currentSub && newId === currentSub) return
    bootstrapSafe("SIGNED_IN")
  }
})

// Safety net: if INITIAL_SESSION never fires within 2s (unlikely with
// detectSessionInUrl: true on by default), bootstrap anyway so the slot
// never gets stuck on the "Signing in…" placeholder.
setTimeout(() => {
  if (!initialBootstrapDone) {
    initialBootstrapDone = true
    bootstrapSafe("timeout-fallback")
  }
}, 2000)

// Initial render so the slot shows the loading pill immediately. The DOM
// is parsed before this script runs (the entry script is `type="module"`
// which is implicitly deferred), so #auth-action exists.
renderSlot()
