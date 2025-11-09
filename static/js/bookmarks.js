import namedDefaultRivers from "../json/namedDefaultRivers.json" with {type: "json"}
import {RiverId} from "./states/state.js";
import {validateRiverNumber} from "./data/main.js";

const key = 'riverBookmarks'

export const bookmarks = (() => {
  let bookmarks = JSON.parse(localStorage.getItem(key)) || []
  const tableBody = document.getElementById('bookmarks-tbody')
  const addModalDiv = document.getElementById('add-river-bookmark')
  const newRiverIdInput = document.getElementById('save-river-id')
  const newRiverNameInput = document.getElementById('save-river-name')

  // the button indicating if the currently displayed river is bookmarked or not
  const bookmarkRiverButton = document.getElementById('save-current-river')
  const isBookmarkedIcon = '<i class="material-icons" style="color: red">favorite</i>'
  const unBookmarkIcon = '<i class="material-icons" style="color: red">favorite_border</i>'

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
          <a data-position="bottom" class="btn modal-trigger" onclick="M.Modal.getInstance(document.getElementById('bookmarks-modal')).close(); setRiverIdFromInput(${b.id})"><i class="material-icons">timeline</i></a>
          <a data-position="bottom" class="btn red" data-bookmarkId="${b.id}"><i class="material-icons">delete</i></a>
        </td>
      </tr>`
      })
      .join('')
    tableBody
      .querySelectorAll('.red')
      .forEach(btn => {
        btn.onclick = () => {
          remove(parseInt(btn.getAttribute('data-bookmarkId')))
          btn.parentElement.parentElement.remove()
        }
      })
  }
  const restoreDefaults = () => {
    namedDefaultRivers.forEach(async r => await add({...r, validate: false}))
    cache()
  }
  const submitForm = async () => {
    const id = newRiverIdInput.value.trim()
    const name = newRiverNameInput.value.trim() || `River ${id}`
    // todo translate these error messages
    if (!/^\d{9}$/.test(id)) {
      M.toast({html: 'Please enter a 9-digit River ID.', classes: 'orange', displayLength: 6000})
      return
    }
    if (bookmarks.find(r => r.id === +id)) {
      M.toast({html: 'This River ID is already bookmarked.', classes: 'orange', displayLength: 6000})
      return
    }
    if (name.length === 0) {
      M.toast({html: 'Please enter a name for the bookmark.', classes: 'orange', displayLength: 6000})
      return
    }
    const addedRiver = await add({id: +id, name: name, validate: true})
    if (!addedRiver){
      M.toast({html: 'This River ID was not found in the RFS datasets. Verify the number and try again.', classes: 'red', displayLength: 6000})
      return
    }
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
      setFavoriteIcon()
      return
    }
    newRiverIdInput.value = riverid || ''
    newRiverNameInput.value = ''
    M.Modal.getInstance(addModalDiv).open()
  }

  restoreBookmarksButton.onclick = restoreDefaults
  submitNewBookmark.onclick = submitForm
  deleteAllBookmarksButtons.forEach(btn => {
    btn.onclick = () => {
      if (confirm('Are you sure you want to delete all bookmarks?')) {
        clear()
        alert('All bookmarks deleted!')
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
