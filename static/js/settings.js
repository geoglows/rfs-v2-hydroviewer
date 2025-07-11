const checkShowMembers = document.getElementById('settingsShowEnsembleMembers')

const useForecastMembers = () => checkShowMembers.checked
const useBiasCorrected = () => false

checkShowMembers.addEventListener('change', () => localStorage.setItem('showEnsembleMembers', checkShowMembers.checked))
checkShowMembers.checked = localStorage.getItem('showEnsembleMembers') === 'true' || false

export {useForecastMembers, useBiasCorrected}
