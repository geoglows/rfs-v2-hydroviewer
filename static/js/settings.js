// reimplement the same concept as useLocalStorage hook but in JS

const useLocalStorage = (key, initialValue) => {
  // Get from local storage then parse stored json or return initial value
  const storedValue = localStorage.getItem(key);
  const parsedValue = storedValue ? JSON.parse(storedValue) : initialValue;

  // Set the value in local storage
  const setValue = (value) => {
    const valueToStore = value instanceof Function ? value(parsedValue) : value;
    localStorage.setItem(key, JSON.stringify(valueToStore));
  };

  return [parsedValue, setValue];
}