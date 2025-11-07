const CACHE_SIZE = 125
const DB_NAME = 'RiverCacheDB'
const STORE_NAME = 'cache'

const _openCacheDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = event => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'key'})
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
const _pruneCache = async db => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
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
const readCache = async key => {
  const db = await _openCacheDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result ? req.result.data : undefined)
    req.onerror = () => reject(req.error)
  })
}
const cacheData = async (data, key) => {
  const db = await _openCacheDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  tx.oncomplete = () => _pruneCache(db)
  store.put({key, data, timestamp: Date.now()})
}
const clearCache = async () => {
  const db = await _openCacheDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
}

export {readCache, cacheData, clearCache, cacheKey}
