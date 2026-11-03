const neostandard = require('neostandard')

module.exports = [
  ...neostandard({ env: ['node', 'jest'] }),
  { ignores: ['test-output/**', 'coverage/**'] }
]
