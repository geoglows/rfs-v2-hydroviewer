const loggingEnabled = false

export const pubSubState = ({initialValue, localStorageKey}) => {
  let state = (initialValue !== undefined) ? initialValue : (localStorageKey ? JSON.parse(localStorage.getItem(localStorageKey)) : null)
  const originalState = JSON.parse(JSON.stringify(state)) // deep clone for reset
  let subscribers = new Set()

  const get = () => state
  const set = newState => {
    if (loggingEnabled) console.log('Setting new state:', newState)
    state = newState
    if (localStorageKey) localStorage.setItem(localStorageKey, JSON.stringify(state))
    publish(newState)
  }
  const update = partialState => {
    if (loggingEnabled) console.log('Updating state with partial state:', partialState)
    if (typeof state !== 'object' || state === null) {
      if (loggingEnabled) console.error('Current state is not an object; cannot perform partial update.')
      return
    }
    if (typeof partialState !== 'object' || partialState === null) {
      if (loggingEnabled) console.error('Partial state must be an object.')
      return
    }
    state = {...state, ...partialState}
    if (localStorageKey) localStorage.setItem(localStorageKey, JSON.stringify(state))
    publish(partialState)
  }
  const reset = () => {
    if (loggingEnabled) console.log('Resetting state to original state:', originalState)
    set(originalState)
  }
  const publish = possiblyPartialStateChange => {
    if (loggingEnabled) console.log('Publishing state change:', possiblyPartialStateChange)
    subscribers.forEach(callback => callback(possiblyPartialStateChange))
  }
  const subscribe = (callback) => {
    if (loggingEnabled) console.log('New subscriber added.', callback)
    if (typeof callback !== 'function') return console.error('Subscriber must be a function')
    subscribers.add(callback)
  }
  const subscribeAndInit = (callback) => {
    subscribe(callback)
    callback(state)
  }
  const unsubscribe = (callback) => subscribers.delete(callback)
  return {get, set, update, reset, subscribe, subscribeAndInit, unsubscribe}
}
