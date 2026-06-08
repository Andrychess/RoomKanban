const pkg = require('./package.json')
const base = pkg.build

/** @type {import('electron-builder').Configuration} */
module.exports = {
  ...base,
  directories: {
    ...base.directories,
    // Отдельная папка на версию — не конфликтует с заблокированным release/win-unpacked
    output: `release/${pkg.version}`
  }
}
