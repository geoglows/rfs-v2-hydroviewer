import {translationDictionary} from "./intl.js"

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

//////////////////////////////////////////////////////////////////////// Multi-select comboboxes
// A native <select multiple> is a poor control for the map filters: no way to
// search 200+ country names, ctrl+click to pick more than one, and a scroll box
// that fights the modal for height. A <select multiple data-multiselect> is
// hidden and mirrored by a combobox instead - chips for what is selected, a
// text input that filters the options as you type.
//
// The <select> stays in the DOM as the source of truth, so callers keep reading
// `selectedOptions`. Code that flips `option.selected` itself must dispatch a
// `change` event on the <select> to redraw the chips (see resetFilterForm).
const multiSelects = []

const buildMultiSelect = select => {
  const wrapper = document.createElement("div")
  wrapper.className = "relative"
  select.after(wrapper)
  select.classList.add("hidden")
  select.tabIndex = -1
  select.setAttribute("aria-hidden", "true")

  const control = document.createElement("div")
  control.className = "field-combobox"

  const input = document.createElement("input")
  input.type = "text"
  input.autocomplete = "off"
  input.id = `${select.id}-combobox`
  input.setAttribute("role", "combobox")
  input.setAttribute("aria-autocomplete", "list")
  input.setAttribute("aria-expanded", "false")

  const menu = document.createElement("ul")
  menu.id = `${select.id}-listbox`
  menu.className = "combobox-menu hidden"
  menu.setAttribute("role", "listbox")
  menu.setAttribute("aria-multiselectable", "true")
  input.setAttribute("aria-controls", menu.id)

  const empty = document.createElement("li")
  empty.className = "hidden px-3 py-2 text-sm text-slate-500"
  empty.dataset.i18n = "ui.noMatchingOptions"
  empty.innerText = translationDictionary?.ui?.noMatchingOptions ?? "No matching options"

  let active = null

  const items = [...select.options].map((option, index) => {
    const item = document.createElement("li")
    item.id = `${menu.id}-option-${index}`
    item.className = "combobox-option"
    item.setAttribute("role", "option")
    item.innerText = option.text
    // mousedown, not click: preventDefault keeps focus in the input so the menu
    // survives picking an option, and you can keep typing the next filter
    item.addEventListener("mousedown", event => {
      event.preventDefault()
      toggleOption(option)
    })
    menu.append(item)
    return {option, item, label: option.text.toLowerCase()}
  })
  menu.append(empty)

  const visibleItems = () => items.filter(({item}) => !item.classList.contains("hidden"))

  const setActive = entry => {
    active?.item.removeAttribute("data-active")
    active = entry
    if (!entry) return input.removeAttribute("aria-activedescendant")
    entry.item.setAttribute("data-active", "")
    input.setAttribute("aria-activedescendant", entry.item.id)
    entry.item.scrollIntoView({block: "nearest"})
  }

  const moveActive = delta => {
    const visible = visibleItems()
    if (!visible.length) return
    const current = visible.findIndex(entry => entry === active)
    const next = current === -1 ? (delta > 0 ? 0 : visible.length - 1) : (current + delta + visible.length) % visible.length
    setActive(visible[next])
  }

  const applyFilter = query => {
    const needle = query.trim().toLowerCase()
    items.forEach(({item, label}) => item.classList.toggle("hidden", !!needle && !label.includes(needle)))
    const visible = visibleItems()
    empty.classList.toggle("hidden", visible.length > 0)
    // typing pre-highlights the top match so Enter picks it, like an autocomplete
    setActive(needle && visible.length ? visible[0] : null)
  }

  // the menu is fixed-positioned under the control so it escapes the modal
  // body's scroll container, which would otherwise clip it
  const positionMenu = () => {
    const rect = control.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 4}px`
    menu.style.left = `${rect.left}px`
    menu.style.width = `${rect.width}px`
  }

  const openMenu = () => {
    positionMenu()
    menu.classList.remove("hidden")
    input.setAttribute("aria-expanded", "true")
    // capture, so scrolling the modal body under the menu is caught too
    window.addEventListener("scroll", positionMenu, true)
    window.addEventListener("resize", positionMenu)
  }

  const closeMenu = () => {
    if (menu.classList.contains("hidden")) return
    menu.classList.add("hidden")
    input.setAttribute("aria-expanded", "false")
    input.value = ""
    applyFilter("")
    window.removeEventListener("scroll", positionMenu, true)
    window.removeEventListener("resize", positionMenu)
  }

  const toggleOption = option => {
    option.selected = !option.selected
    select.dispatchEvent(new Event("change", {bubbles: true}))
    input.value = ""
    applyFilter("")
    input.focus()
  }

  const render = () => {
    control.querySelectorAll("[data-combobox-chip]").forEach(chip => chip.remove())
    const selected = [...select.selectedOptions]
    const chips = document.createDocumentFragment()
    selected.forEach(option => {
      const chip = document.createElement("span")
      chip.dataset.comboboxChip = ""
      chip.className = "combobox-chip"
      chip.innerText = option.text
      const remove = document.createElement("button")
      remove.type = "button"
      remove.innerHTML = "&times;"
      remove.setAttribute("aria-label", `${translationDictionary?.ui?.removeFilter ?? "Remove"} ${option.text}`)
      remove.addEventListener("click", event => {
        event.stopPropagation()  // the chip sits inside the control, which opens the menu on click
        toggleOption(option)
      })
      chip.append(remove)
      chips.append(chip)
    })
    control.insertBefore(chips, input)
    // the placeholder would collide with the chips, and the data attribute has
    // to go with it so a language change doesn't hydrate it back in
    if (selected.length) {
      input.placeholder = ""
      delete input.dataset.i18nPlaceholder
    } else {
      input.placeholder = translationDictionary?.ui?.phTypeToFilter ?? ""
      input.dataset.i18nPlaceholder = "ui.phTypeToFilter"
    }
    items.forEach(({option, item}) => item.setAttribute("aria-selected", String(option.selected)))
  }

  control.addEventListener("click", () => {
    openMenu()
    input.focus()
  })
  input.addEventListener("input", () => {
    openMenu()
    applyFilter(input.value)
  })
  input.addEventListener("keydown", event => {
    const isOpen = !menu.classList.contains("hidden")
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!isOpen) return openMenu()
      moveActive(event.key === "ArrowDown" ? 1 : -1)
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (!isOpen) return openMenu()
      const visible = visibleItems()
      const entry = active ?? (visible.length === 1 ? visible[0] : null)
      if (entry) toggleOption(entry.option)
    } else if (event.key === "Escape" && isOpen) {
      event.stopPropagation()  // otherwise the document handler closes the whole modal
      closeMenu()
    } else if (event.key === "Backspace" && !input.value) {
      const last = [...select.selectedOptions].at(-1)
      if (last) toggleOption(last)
    } else if (event.key === "Tab") {
      closeMenu()
    }
  })
  select.addEventListener("change", render)

  // the <select> is display:none, so clicking its <label> can't focus it
  document.querySelector(`label[for="${select.id}"]`)?.addEventListener("click", event => {
    event.preventDefault()
    openMenu()
    input.focus()
  })

  control.append(input)
  wrapper.append(control, menu)
  render()
  multiSelects.push({wrapper, closeMenu})
}

const initMultiSelects = () => {
  document.querySelectorAll("select[multiple][data-multiselect]").forEach(buildMultiSelect)
  document.addEventListener("mousedown", event => {
    multiSelects.forEach(({wrapper, closeMenu}) => {
      if (!wrapper.contains(event.target)) closeMenu()
    })
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
  initMultiSelects()
}

// open/close functions should be globally accessible for onclick functions
window.openModal = openModal
window.closeModal = closeModal
