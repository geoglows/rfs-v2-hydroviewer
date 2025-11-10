/*
A pub-sub state implementation with localStorage caching and optional logging events
Copyright (c) 2025 Dr Riley Hales
Redistribution and use in source and binary forms, with or without modification, are permitted (subject to the limitations in the disclaimer below) provided that the following conditions are met:
* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name of [Owner Organization] nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED BY THIS LICENSE. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
*/

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
  const addSubscriber = (callback) => {
    if (loggingEnabled) console.log('New subscriber added.', callback)
    if (typeof callback !== 'function') return console.error('Subscriber must be a function')
    subscribers.add(callback)
  }
  const addSubscriberAndInit = (callback) => {
    addSubscriber(callback)
    callback(state)
  }
  const unsubscribe = (callback) => subscribers.delete(callback)
  return {get, set, update, reset, addSubscriber, addSubscriberAndInit, unsubscribe}
}
