const CACHE_SIZE = 300
const DB_NAME = 'hydroviewerDB'

const cacheDbStoreName = 'discharge'
const riversDbStoreName = 'rivers'

const openDb = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = event => {
      const db = event.target.result
      for (const name of [cacheDbStoreName, riversDbStoreName]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, {keyPath: 'key'})
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
const pruneCache = async ({storeName}) => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    const req = store.getAll()

    req.onsuccess = function () {
      const items = req.result
      if (items.length > CACHE_SIZE) {
        items.sort((a, b) => a.timestamp - b.timestamp)
        const toRemove = items.length - CACHE_SIZE
        for (let i = 0; i < toRemove; i++) {
          store.delete(items[i].key)
        }
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}
const cacheKey = ({riverId, type, corrected, date}) => {
  if (type === 'retro') {
    date = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '')
  } else if (type === 'retper') {
    date = 'static'
  } else if (type === 'forecast' && !date) {
    console.error('For forecast type, please provide a date.')
  }
  return `${riverId}_${type}_${corrected}_${date}`
}
const readStore = async ({storeName, key}) => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result ? req.result.data : undefined)
    req.onerror = () => reject(req.error)
  })
}
const saveStore = async ({storeName, key, data}) => {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  if (storeName === cacheDbStoreName) {
    tx.oncomplete = () => pruneCache({storeName})
  }
  store.put({key, data, timestamp: Date.now()})
}
const clearStore = async () => {
  const db = await openDb()
  const tx = db.transaction([cacheDbStoreName, riversDbStoreName], 'readwrite')
  for (const name of [cacheDbStoreName, riversDbStoreName]) {
    const store = tx.objectStore(name)
    store.clear()
  }
}

export {
  openDb,
  readStore,
  saveStore,
  clearStore,
  cacheKey,

  cacheDbStoreName,
  riversDbStoreName,
}
