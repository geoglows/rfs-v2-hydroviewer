import namedDefaultRivers from "./json/namedDefaultRivers.json" with {type: "json"}
import {RiverId} from "./states/state.js";
import {validateRiverNumber} from "./data/main.js";
import {translationDictionary} from "./intl.js";
import {openModal, closeModal, showToast} from "./components.js";
import {RFS_LAYER_URL} from "./ui.js";
import {auth, rfs, userId, subscribeAuth} from "./auth.js";
import {chartLine, heartOutline, heartSolid, trash} from "./icons.js";

/*
  Bookmarks are stored locally first (localStorage is the source of truth for the UI) and synced to the user's
  profile in the `rfs.bookmarks` table when signed in. Local record shape:
    {river_id, river_name, lat, lon, synced, deleted}
  `synced: false` marks a record that still needs to be pushed; `deleted: true` is a tombstone awaiting deletion on
  the server. See apps.geoglows-db/app-development-instructions/rfs-user-data/SKILL.md
 */
const key = 'riverBookmarks'
const lastUserKey = 'riverBookmarksUserId'
const AUTH_ERRORS = ["42501", "PGRST301"]

const isValidRecord = b => Number.isInteger(b.river_id) && b.river_id >= 100000000 && b.river_id <= 999999999
  && typeof b.river_name === 'string' && b.river_name.length >= 1 && b.river_name.length <= 100
  && typeof b.lat === 'number' && b.lat >= -90 && b.lat <= 90
  && typeof b.lon === 'number' && b.lon >= -180 && b.lon <= 180

// look up a representative point (midpoint of the reach) for a river from the RFS map service
const fetchRiverLocation = async riverId => {
  const params = new URLSearchParams({where: `comid=${riverId}`, outFields: 'comid', returnGeometry: 'true', outSR: '4326', f: 'json'})
  const response = await fetch(`${RFS_LAYER_URL}/0/query?${params}`)
  if (!response.ok) throw new Error(`River layer query failed: ${response.status}`)
  const json = await response.json()
  const path = json?.features?.[0]?.geometry?.paths?.[0]
  if (!path?.length) return null
  const [lon, lat] = path[Math.floor(path.length / 2)]
  return {lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5}
}

export const bookmarks = (() => {
  // load and migrate legacy records ({id, name}) to the current shape
  let bookmarks = (JSON.parse(localStorage.getItem(key)) || []).map(b => 'river_id' in b ? b : ({
    river_id: b.id, river_name: b.name, lat: null, lon: null, synced: false, deleted: false
  }))
  let syncing = false
  const tableBody = document.getElementById('bookmarks-tbody')
  const addModalDiv = document.getElementById('add-river-bookmark')
  const newRiverIdInput = document.getElementById('save-river-id')
  const newRiverNameInput = document.getElementById('save-river-name')
  const syncStatusDiv = document.getElementById('bookmarks-sync-status')

  // the button indicating if the currently displayed river is bookmarked or not
  const bookmarkRiverButton = document.getElementById('save-current-river')
  const isBookmarkedIcon = `<span class="text-red-600">${heartSolid}</span>`
  const unBookmarkIcon = `<span class="text-red-600">${heartOutline}</span>`

  // bookmarks view modal
  const restoreBookmarksButton = document.getElementById('restore-bookmarks-button')
  const submitNewBookmark = document.getElementById('submit-new-bookmark')
  const deleteAllBookmarksButtons = Array.from(document.getElementsByClassName('delete-all-bookmarks'))

  const visible = () => bookmarks.filter(b => !b.deleted)
  const pendingCount = () => bookmarks.filter(b => !b.synced || b.deleted).length
  const isBookmarked = riverid => visible().some(r => r.river_id === riverid)

  const setFavoriteIcon = () => {
    const id = RiverId.get()
    bookmarkRiverButton.innerHTML = isBookmarked(id) ? isBookmarkedIcon : unBookmarkIcon
    bookmarkRiverButton.onclick = () => toggle(id)
  }
  const cache = () => {
    localStorage.setItem(key, JSON.stringify(bookmarks))
    table()
  }

  //////////////////////////////////////////////////////////////////////// Sync with the user's profile
  const syncStatus = () => {
    if (!syncStatusDiv) return
    const pending = pendingCount()
    if (pending === 0) {
      syncStatusDiv.classList.add('hidden')
      syncStatusDiv.innerHTML = ''
      return
    }
    syncStatusDiv.classList.remove('hidden')
    if (userId()) {
      syncStatusDiv.innerHTML = `<span>${translationDictionary.ui.bookmarksPendingSync.replace('{n}', pending)}</span>
        <button class="btn btn-ghost shrink-0" id="bookmarks-retry-sync">${translationDictionary.ui.bookmarksRetrySync}</button>`
      syncStatusDiv.querySelector('#bookmarks-retry-sync').onclick = () => sync()
    } else {
      syncStatusDiv.innerHTML = `<span>${translationDictionary.ui.bookmarksSignInToSave}</span>
        <button class="btn btn-ghost shrink-0" id="bookmarks-sign-in">${translationDictionary.ui.bookmarksSignIn}</button>`
      syncStatusDiv.querySelector('#bookmarks-sign-in').onclick = () => auth.openSignIn()
    }
  }
  const handleSyncError = error => {
    console.error('bookmark sync error', error)
    if (AUTH_ERRORS.includes(error.code)) {
      showToast(translationDictionary.ui.bookmarksSignInToSave, {type: 'warning', duration: 6000})
    } else if (error.code === 'P0001') {
      showToast(translationDictionary.ui.bookmarkLimitReached, {type: 'error', duration: 8000})
    } else if (error.code === '23514' || error.code === '22P02') {
      // client-side validation should prevent this; drop anything invalid so it stops blocking the queue
      bookmarks = bookmarks.filter(b => b.deleted || isValidRecord(b))
      cache()
    } else {
      showToast(translationDictionary.ui.bookmarkSyncFailed, {type: 'warning', duration: 6000})
    }
  }
  // fill in lat/lon for records that were created before locations were stored or while offline
  const hydrateLocations = async () => {
    const missing = bookmarks.filter(b => !b.deleted && (b.lat === null || b.lon === null))
    if (!missing.length) return
    await Promise.all(missing.map(async b => {
      try {
        const loc = await fetchRiverLocation(b.river_id)
        if (loc) Object.assign(b, loc)
      } catch (e) {
        console.warn(`could not locate river ${b.river_id}`, e)
      }
    }))
    cache()
  }
  // push every unsynced local change, then pull the server list. `merge: true` keeps server rows on conflict (used
  // when a device's bookmarks are first merged into an account).
  const sync = async ({merge = false} = {}) => {
    const uid = userId()
    if (!uid || syncing) return syncStatus()
    syncing = true
    try {
      await hydrateLocations()
      const pending = bookmarks.filter(b => !b.synced && !b.deleted && isValidRecord(b))
      const tombstones = bookmarks.filter(b => b.deleted).map(b => b.river_id)
      if (pending.length) {
        const {error} = await rfs.from("bookmarks").upsert(
          pending.map(({river_id, river_name, lat, lon}) => ({user_id: uid, river_id, river_name, lat, lon})),
          {onConflict: "user_id,river_id", ignoreDuplicates: merge}
        )
        if (error) {
          if (error.code === '23505') pending.forEach(b => b.synced = true)  // already there
          else return handleSyncError(error)
        }
      }
      if (tombstones.length) {
        const {error} = await rfs.from("bookmarks").delete().in("river_id", tombstones)
        if (error) return handleSyncError(error)
      }
      // pull: the server state replaces local, absorbing edits from other devices/apps
      const {data, error} = await rfs
        .from("bookmarks")
        .select("river_id, river_name, lat, lon, created_at")
        .order("created_at", {ascending: false})
      if (error) return handleSyncError(error)
      bookmarks = data.map(({river_id, river_name, lat, lon}) => ({river_id, river_name, lat, lon, synced: true, deleted: false}))
      localStorage.setItem(lastUserKey, uid)
      cache()
      setFavoriteIcon()
    } catch (e) {
      console.error('bookmark sync failed', e)
      showToast(translationDictionary.ui.bookmarkSyncFailed, {type: 'warning', duration: 6000})
    } finally {
      syncing = false
      syncStatus()
    }
  }
  const onAuthChange = state => {
    const uid = state.user?.id
    if (!uid) return syncStatus()  // signed out: keep the local copy as device-only bookmarks
    const lastUser = localStorage.getItem(lastUserKey)
    if (lastUser && lastUser !== uid) {
      // a different account signed in on this device: ask before merging the device's list into it
      if (visible().length && confirm(translationDictionary.ui.bookmarksMergePrompt)) {
        bookmarks = visible().map(b => ({...b, synced: false}))
      } else {
        bookmarks = []
      }
      cache()
      return sync({merge: true})
    }
    // first sign-in on this device (or the same user again): merge device-only bookmarks then pull
    return sync({merge: !lastUser})
  }

  //////////////////////////////////////////////////////////////////////// Local edits
  const add = async ({id, name, lat = null, lon = null, validate = true}) => {
    if (isBookmarked(id)) return false
    if (validate) {
      const valid = await validateRiverNumber({riverId: id})
      if (!valid) return false
    }
    if (lat === null || lon === null) {
      try {
        const loc = await fetchRiverLocation(id)
        if (loc) ({lat, lon} = loc)
      } catch (e) {
        console.warn(`could not locate river ${id}, will retry during sync`, e)
      }
    }
    bookmarks = bookmarks.filter(r => r.river_id !== id)  // drop any tombstone for this river
    bookmarks.push({river_id: id, river_name: name.slice(0, 100), lat, lon, synced: false, deleted: false})
    cache()
    setFavoriteIcon()
    return true
  }
  const remove = id => {
    // records never saved to the profile can be dropped; synced ones leave a tombstone until deleted on the server
    bookmarks = bookmarks
      .filter(r => !(r.river_id === id && !r.synced))
      .map(r => r.river_id === id ? {...r, deleted: true} : r)
    cache()
    setFavoriteIcon()
    sync()
  }
  const clear = () => {
    bookmarks = bookmarks.filter(r => r.synced).map(r => ({...r, deleted: true}))
    cache()
    sync()
  }
  const list = () => visible()
  const table = () => {
    tableBody.innerHTML = visible()
      .map(b => {
        return `<tr>
        <td>${b.river_id}</td>
        <td>${b.river_name}</td>
        <td>
          <div class="flex gap-1">
            <button class="icon-btn" onclick="closeModal('bookmarks-modal'); setRiverIdFromInput(${b.river_id})">${chartLine}</button>
            <button class="icon-btn text-red-600 delete-bookmark" data-bookmarkId="${b.river_id}">${trash}</button>
          </div>
        </td>
      </tr>`
      })
      .join('')
    tableBody
      .querySelectorAll('.delete-bookmark')
      .forEach(btn => {
        btn.onclick = () => remove(parseInt(btn.getAttribute('data-bookmarkId')))
      })
    syncStatus()
  }
  const restoreDefaults = async () => {
    await Promise.all(namedDefaultRivers.map(r => add({...r, validate: false})))
    cache()
    sync()
  }
  const submitForm = async () => {
    const id = newRiverIdInput.value.trim()
    const name = newRiverNameInput.value.trim()
    if (!/^\d{9}$/.test(id)) {
      showToast(translationDictionary.ui.bookmarkInvalidId, {type: 'warning', duration: 6000})
      return
    }
    if (isBookmarked(+id)) {
      showToast(translationDictionary.ui.bookmarkDuplicate, {type: 'warning', duration: 6000})
      return
    }
    if (name.length === 0) {
      showToast(translationDictionary.ui.bookmarkEnterName, {type: 'warning', duration: 6000})
      return
    }
    if (name.length > 100) {
      showToast(translationDictionary.ui.bookmarkNameTooLong, {type: 'warning', duration: 6000})
      return
    }
    const addedRiver = await add({id: +id, name: name, validate: true})
    if (!addedRiver) {
      showToast(translationDictionary.ui.bookmarkNotFound, {type: 'error', duration: 6000})
      return
    }
    newRiverIdInput.value = ''
    newRiverNameInput.value = ''
    closeModal(addModalDiv)
    showToast(translationDictionary.ui.bookmarkAdded, {type: 'success', duration: 2000})
    sync()
  }

  const toggle = riverid => {
    if (isBookmarked(riverid)) {
      remove(riverid)
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
        setFavoriteIcon()
      }
    }
  })
  if (bookmarks.length === 0 && !localStorage.getItem(lastUserKey)) restoreDefaults() // on first load, populate with defaults
  table()

  subscribeAuth(onAuthChange)
  window.addEventListener('online', () => sync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync()
  })

  return {
    add, cache, remove, clear, list, table, restoreDefaults, submitForm, toggle, isBookmarked, setFavoriteIcon, sync
  }
})()
