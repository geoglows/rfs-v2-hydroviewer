// Small, dependency-free UI behaviors for the pieces Tailwind doesn't ship:
// modals, dropdown menus, and toasts. Styling is all Tailwind utilities in the
// markup; this file only owns the interaction/state. Tooltips are pure CSS
// (see the `group`/`tooltip` utilities on the trigger elements).

//////////////////////////////////////////////////////////////////////// Modals
// A modal is a fixed, full-screen overlay toggled via the `hidden`/`flex`
// utilities. openModal/closeModal accept either the element or its id.
//
// Every overlay is `inset-0`, so a modal opened on top of another one (settings
// -> bias-correction warning, bookmarks -> add-bookmark) would otherwise be
// stacked purely by DOM order and could end up *behind* the modal that spawned
// it, swallowing clicks on its close button. `openStack` tracks open modals and
// assigns an increasing z-index so the most recently opened is always on top.
const BASE_MODAL_Z = 1000
let openStack = []

const asElement = target =>
  typeof target === "string" ? document.getElementById(target.replace(/^#/, "")) : target

export const openModal = target => {
  const modal = asElement(target)
  if (!modal || openStack.includes(modal)) return
  openStack.push(modal)
  modal.style.zIndex = String(BASE_MODAL_Z + openStack.length)
  modal.classList.remove("hidden")
  modal.classList.add("flex")
}

export const closeModal = target => {
  const modal = asElement(target)
  if (!modal) return
  openStack = openStack.filter(m => m !== modal)
  modal.classList.add("hidden")
  modal.classList.remove("flex")
  modal.style.zIndex = ""
}

// Listeners are delegated from `document` rather than bound to each element, so
// they keep working after any modal's contents are re-rendered (i18n hydration,
// bookmark table rebuilds, etc).
const initModals = () => {
  document.addEventListener("click", e => {
    const opener = e.target.closest?.("[data-modal-open]")
    if (opener) {
      e.preventDefault()
      openModal(opener.dataset.modalOpen)
      return
    }

    // <button data-modal-close> closes its own modal; an explicit
    // data-modal-close="some-id" closes that one instead.
    const closer = e.target.closest?.("[data-modal-close]")
    if (closer) {
      e.preventDefault()
      closeModal(closer.dataset.modalClose || closer.closest("[data-modal]"))
      return
    }

    // Clicking the backdrop itself (not the card) closes that modal.
    if (e.target.matches?.("[data-modal]")) closeModal(e.target)
  })

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openStack.length) closeModal(openStack.at(-1))
  })
}

//////////////////////////////////////////////////////////////////////// Dropdown menus
// <button data-dropdown="menu-id"> toggles the menu with id `menu-id`. The menu
// is fixed-positioned under the trigger so it escapes any clipped modal.
const closeAllDropdowns = () =>
  document.querySelectorAll("[data-dropdown-menu]:not(.hidden)").forEach(menu => menu.classList.add("hidden"))

const initDropdowns = () => {
  document.querySelectorAll("[data-dropdown]").forEach(trigger => {
    const menu = document.getElementById(trigger.dataset.dropdown)
    if (!menu) return
    menu.setAttribute("data-dropdown-menu", "")
    trigger.addEventListener("click", e => {
      e.preventDefault()
      const willOpen = menu.classList.contains("hidden")
      closeAllDropdowns()
      if (willOpen) {
        const rect = trigger.getBoundingClientRect()
        menu.style.top = `${rect.bottom + 4}px`
        menu.style.right = `${window.innerWidth - rect.right}px`
        menu.classList.remove("hidden")
      }
    })
  })

  document.addEventListener("click", e => {
    if (e.target.closest("[data-dropdown]")) return
    if (!e.target.closest("[data-dropdown-menu]") || e.target.closest("a, button")) closeAllDropdowns()
  })
}

//////////////////////////////////////////////////////////////////////// Toasts
const TOAST_STYLES = {
  info: "bg-sky-600",
  success: "bg-green-600",
  warning: "bg-orange-500",
  error: "bg-red-600",
}

let toastHost = null
const getToastHost = () => {
  if (!toastHost) {
    toastHost = document.createElement("div")
    toastHost.className = "fixed inset-x-0 bottom-6 z-[2000] flex flex-col items-center gap-2 pointer-events-none"
    document.body.appendChild(toastHost)
  }
  return toastHost
}

export const showToast = (message, {type = "info", duration = 4000} = {}) => {
  const toast = document.createElement("div")
  toast.className =
    `${TOAST_STYLES[type] ?? TOAST_STYLES.info} pointer-events-auto max-w-lg rounded-lg px-5 py-3 ` +
    "text-center text-white shadow-lg opacity-0 translate-y-2 transition duration-300"
  toast.innerHTML = message
  getToastHost().appendChild(toast)
  requestAnimationFrame(() => toast.classList.remove("opacity-0", "translate-y-2"))
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2")
    setTimeout(() => toast.remove(), 350)
  }, duration)
  return toast
}

//////////////////////////////////////////////////////////////////////// Init
export const initComponents = () => {
  initModals()
  initDropdowns()
}

// open/close functions should be globally accessible for onclick functions
window.openModal = openModal
window.closeModal = closeModal
