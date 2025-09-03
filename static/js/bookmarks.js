import namedDefaultRivers from "../json/namedDefaultRivers.json" with {type: "json"}

const key = 'riverBookmarks'

export const riverBookmarks = (() => {
  let bookmarks = JSON.parse(localStorage.getItem(key)) || []

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
    return bookmarks
      .map(b => {
        return `<tr>
        <td>${b.id}</td>
        <td>${b.name}</td>
        <td>
          <button class="btn blue" onclick=" M.Modal.getInstance(document.getElementById('bookmarks-modal')).close(); setRiverId('${b.id}')">View</button>
          <button class="btn red" onclick="remove('${b.id}'); this.parentElement.parentElement.remove();">Remove</button>
        </td>
      </tr>`
      })
      .join('')
  }
  const restoreDefaults = () => {
    clear()
    namedDefaultRivers.forEach(r => add(r))
    cache()
  }

  if (bookmarks.length === 0) restoreDefaults() // on first load, populate with defaults

  return {
    add, remove, clear, list, table, restoreDefaults
  }
})()
