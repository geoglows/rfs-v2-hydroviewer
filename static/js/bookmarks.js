import namedDefaultRivers from "../json/namedDefaultRivers.json" with {type: "json"}

const key = 'riverBookmarks'

export const riverBookmarks = (() => {
  let bookmarks = JSON.parse(localStorage.getItem(key)) || []
  const tableModalDiv = document.getElementById('bookmarks-modal')
  const tableBody = document.getElementById('bookmarks-tbody')
  const addModalDiv = document.getElementById('add-river-bookmark')
  const newRiverIdInput = document.getElementById('save-river-id')
  const newRiverNameInput = document.getElementById('save-river-name')

  const cache = () => {
    localStorage.setItem(key, JSON.stringify(bookmarks))
  }
  const add = ({id, name}) => {
    if (bookmarks.find(r => r.id === id)) return
    bookmarks.push({id, name})
    cache()
  }
  const remove = id => {
    bookmarks = bookmarks.filter(r => r.id !== id)
    cache()
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
          <a data-tooltip="View Charts" data-position="bottom" class="btn modal-trigger tooltipped" onclick="M.Modal.getInstance(document.getElementById('bookmarks-modal')).close(); setRiverId('${b.id}')"><i class="material-icons">timeline</i></a>
          <a data-tooltip="Remove Bookmark" data-position="bottom" class="btn red tooltipped" onclick="bookmarks.remove('${b.id}'); this.parentElement.parentElement.remove();"><i class="material-icons">delete</i></a>
        </td>
      </tr>`
      })
      .join('')
  }
  const restoreDefaults = () => {
    clear()
    namedDefaultRivers.forEach(r => add(r))
    table()
    cache()
  }
  const submitForm = () => {
    const id = newRiverIdInput.value.trim()
    const name = newRiverNameInput.value.trim() || `River ${id}`
    if (!/^\d{9}$/.test(id)) {
      M.toast({html: 'Please enter a valid 9-digit River ID.', classes: 'yellow', displayLength: 6000})
      return
    }
    if (bookmarks.find(r => r.id === id)) {
      M.toast({html: 'This River ID is already bookmarked.', classes: 'yellow', displayLength: 6000})
      return
    }
    if (name.length === 0) {
      M.toast({html: 'Please enter a name for the bookmark.', classes: 'yellow', displayLength: 6000})
      return
    }
    add({id: parseInt(id), name: name})
    table()
    newRiverIdInput.value = ''
    newRiverNameInput.value = ''
    M.Modal.getInstance(addModalDiv).close()
    M.toast({html: 'River Bookmarked!', classes: 'green', displayLength: 2000})
  }

  if (bookmarks.length === 0) restoreDefaults() // on first load, populate with defaults
  table()

  return {
    cache,  remove, clear, list, table, restoreDefaults, submitForm
  }
})()

window.bookmarks = {
  restoreDefaults: riverBookmarks.restoreDefaults,
  submitForm: riverBookmarks.submitForm,
  add: riverBookmarks.add,
  remove: riverBookmarks.remove,
  generateTable: riverBookmarks.table
}
