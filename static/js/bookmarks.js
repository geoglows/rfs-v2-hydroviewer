import namedDefaultRivers from "../json/namedDefaultRivers.json" with {type: "json"}
import {loadStatusManager} from "./state.js";

const key = 'riverBookmarks'

export const bookmarks = (() => {
  let bookmarks = JSON.parse(localStorage.getItem(key)) || []
  const tableModalDiv = document.getElementById('bookmarks-modal')
  const tableBody = document.getElementById('bookmarks-tbody')
  const addModalDiv = document.getElementById('add-river-bookmark')
  const newRiverIdInput = document.getElementById('save-river-id')
  const newRiverNameInput = document.getElementById('save-river-name')

  const cache = () => {
    localStorage.setItem(key, JSON.stringify(bookmarks))
    table()
  }
  const add = ({id, name}) => {
    if (bookmarks.find(r => r.id === id)) return
    bookmarks.push({id, name})
    cache()
    loadStatusManager.refreshBookmarkIcon()
  }
  const remove = id => {
    bookmarks = bookmarks.filter(r => r.id !== id)
    cache()
    loadStatusManager.refreshBookmarkIcon()
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
          <a data-position="bottom" class="btn modal-trigger" onclick="M.Modal.getInstance(document.getElementById('bookmarks-modal')).close(); setRiverId('${b.id}')"><i class="material-icons">timeline</i></a>
          <a data-position="bottom" class="btn red" onclick="bookmarks.remove(${b.id}); this.parentElement.parentElement.remove();"><i class="material-icons">delete</i></a>
        </td>
      </tr>`
      })
      .join('')
  }
  const restoreDefaults = () => {
    namedDefaultRivers.forEach(r => add(r))
    cache()
  }
  const submitForm = () => {
    const id = newRiverIdInput.value.trim()
    const name = newRiverNameInput.value.trim() || `River ${id}`
    if (!/^\d{9}$/.test(id)) {
      M.toast({html: 'Please enter a valid 9-digit River ID.', classes: 'orange', displayLength: 6000})
      return
    }
    if (bookmarks.find(r => r.id === id)) {
      M.toast({html: 'This River ID is already bookmarked.', classes: 'orange', displayLength: 6000})
      return
    }
    if (name.length === 0) {
      M.toast({html: 'Please enter a name for the bookmark.', classes: 'orange', displayLength: 6000})
      return
    }
    add({id: parseInt(id), name: name})
    cache()
    newRiverIdInput.value = ''
    newRiverNameInput.value = ''
    M.Modal.getInstance(addModalDiv).close()
    M.toast({html: 'River Bookmarked!', classes: 'green', displayLength: 2000})
  }
  const isBookmarked = riverid => bookmarks.some(r => r.id === riverid)

  const toggle = riverid => {
    if (isBookmarked(riverid)) {
      remove(riverid)
      loadStatusManager.refreshBookmarkIcon()
      return
    }
    newRiverIdInput.value = riverid || ''
    newRiverNameInput.value = ''
    M.Modal.getInstance(addModalDiv).open()
  }

  if (bookmarks.length === 0) restoreDefaults() // on first load, populate with defaults
  table()

  return {
    add, cache,  remove, clear, list, table, restoreDefaults, submitForm, toggle, isBookmarked
  }
})()

window.bookmarks = {
  restoreDefaults: bookmarks.restoreDefaults,
  submitForm: bookmarks.submitForm,
  add: bookmarks.add,
  remove: bookmarks.remove,
  generateTable: bookmarks.table,
  toggle: bookmarks.toggle,
}
