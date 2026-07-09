import namedDefaultRivers from "./json/namedDefaultRivers.json" with {type: "json"}
import {RiverId} from "./states/state.js";
import {validateRiverNumber} from "./data/main.js";
import {translationDictionary} from "./intl.js";
import {openModal, closeModal, showToast} from "./components.js";
import {chartLine, heartOutline, heartSolid, trash} from "./icons.js";

const key = 'riverBookmarks'

export const bookmarks = (() => {
  let bookmarks = JSON.parse(localStorage.getItem(key)) || []
  const tableBody = document.getElementById('bookmarks-tbody')
  const addModalDiv = document.getElementById('add-river-bookmark')
  const newRiverIdInput = document.getElementById('save-river-id')
  const newRiverNameInput = document.getElementById('save-river-name')

  // the button indicating if the currently displayed river is bookmarked or not
  const bookmarkRiverButton = document.getElementById('save-current-river')
  const isBookmarkedIcon = `<span class="text-red-600">${heartSolid}</span>`
  const unBookmarkIcon = `<span class="text-red-600">${heartOutline}</span>`

  // bookmarks view modal
  const restoreBookmarksButton = document.getElementById('restore-bookmarks-button')
  const submitNewBookmark = document.getElementById('submit-new-bookmark')
  const deleteAllBookmarksButtons = Array.from(document.getElementsByClassName('delete-all-bookmarks'))

  const setFavoriteIcon = () => {
    const id = RiverId.get()
    let bookmarked = isBookmarked(id)
    bookmarkRiverButton.innerHTML = bookmarked ? isBookmarkedIcon : unBookmarkIcon
    bookmarkRiverButton.onclick = () => toggle(id)
  }
  const cache = () => {
    localStorage.setItem(key, JSON.stringify(bookmarks))
    table()
  }
  const add = async ({id, name, validate = true}) => {
    if (bookmarks.find(r => r.id === id)) return false
    if (validate) {
      const valid = await validateRiverNumber({riverId: id})
      if (!valid) return false
    }
    bookmarks.push({id, name})
    cache()
    setFavoriteIcon()
    return true
  }
  const remove = id => {
    bookmarks = bookmarks.filter(r => r.id !== id)
    cache()
    setFavoriteIcon()
  }
  const clear = () => {
    bookmarks = []
    localStorage.removeItem(key)
  }
  const list = () => bookmarks
  const table = () => {
    tableBody.innerHTML = bookmarks
      .map(b => {
        return `<tr>
        <td>${b.id}</td>
        <td>${b.name}</td>
        <td>
          <div class="flex gap-1">
            <button class="icon-btn" onclick="closeModal('bookmarks-modal'); setRiverIdFromInput(${b.id})">${chartLine}</button>
            <button class="icon-btn text-red-600 delete-bookmark" data-bookmarkId="${b.id}">${trash}</button>
          </div>
        </td>
      </tr>`
      })
      .join('')
    tableBody
      .querySelectorAll('.delete-bookmark')
      .forEach(btn => {
        btn.onclick = () => {
          remove(parseInt(btn.getAttribute('data-bookmarkId')))
          btn.closest('tr').remove()
        }
      })
  }
  const restoreDefaults = () => {
    namedDefaultRivers.forEach(async r => await add({...r, validate: false}))
    cache()
  }
  const submitForm = async () => {
    const id = newRiverIdInput.value.trim()
    const name = newRiverNameInput.value.trim()
    if (!/^\d{9}$/.test(id)) {
      showToast(translationDictionary.ui.bookmarkInvalidId, {type: 'warning', duration: 6000})
      return
    }
    if (bookmarks.find(r => r.id === +id)) {
      showToast(translationDictionary.ui.bookmarkDuplicate, {type: 'warning', duration: 6000})
      return
    }
    if (name.length === 0) {
      showToast(translationDictionary.ui.bookmarkEnterName, {type: 'warning', duration: 6000})
      return
    }
    const addedRiver = await add({id: +id, name: name, validate: true})
    if (!addedRiver){
      showToast(translationDictionary.ui.bookmarkNotFound, {type: 'error', duration: 6000})
      return
    }
    cache()
    newRiverIdInput.value = ''
    newRiverNameInput.value = ''
    closeModal(addModalDiv)
    showToast(translationDictionary.ui.bookmarkAdded, {type: 'success', duration: 2000})
  }
  const isBookmarked = riverid => bookmarks.some(r => r.id === riverid)

  const toggle = riverid => {
    if (isBookmarked(riverid)) {
      remove(riverid)
      setFavoriteIcon()
      return
    }
    newRiverIdInput.value = riverid || ''
    newRiverNameInput.value = ''
    openModal(addModalDiv)
  }

  restoreBookmarksButton.onclick = restoreDefaults
  submitNewBookmark.onclick = submitForm
  deleteAllBookmarksButtons.forEach(btn => {
    btn.onclick = () => {
      if (confirm(translationDictionary.ui.confirmDeleteBookmarks)) {
        clear()
        alert(translationDictionary.ui.bookmarksDeleted)
        table()
        setFavoriteIcon()
      }
    }
  })
  if (bookmarks.length === 0) restoreDefaults() // on first load, populate with defaults
  table()

  return {
    add, cache, remove, clear, list, table, restoreDefaults, submitForm, toggle, isBookmarked, setFavoriteIcon
  }
})()
