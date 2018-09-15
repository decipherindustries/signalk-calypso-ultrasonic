const Ultrasonic = require('./lib/ultrasonic')

module.exports = function signalkCalypsoUltrasonic (app) {
  const plugin = {}
  let _ultrasonic = null

  plugin.Ultrasonic = Ultrasonic
  plugin.id = 'calypso-ultrasonic'
  plugin.name = 'Calypso Ultrasonic plugin for Signal K'
  plugin.description = plugin.name

  plugin.schema = {
    type: 'object',
    required: [
      'setRate',
      'setCompass'
    ],
    properties: {
      setRate: {
        type: 'number',
        title: 'Update rate (Hz)',
        default: -1
      },
      setCompass: {
        type: 'number',
        title: 'Compass/9-DOF sensor state',
        default: -1
      },
      maxRetries: {
        type: 'number',
        title: 'Max. number of connection retries (0 = infinite)',
        default: 0
      }
      // @TODO add setAngleOffset & setWindSpeedCorrection options
    }
  }

  plugin.start = function (options) {
    if (_ultrasonic !== null) {
      plugin.stop()
    }

    const opts = {
      setRate: false,
      setCompass: false,
      maxRetries: Infinity
    }

    _ultrasonic = new plugin.Ultrasonic(opts)

    _ultrasonic.on('delta', delta => {
      app.handleMessage('pluginId', delta)
    })

    _ultrasonic.start()
  }

  plugin.stop = function () {
    if (_ultrasonic === null) {
      return
    }

    // Tear-down
    _ultrasonic.removeAllListeners()
    _ultrasonic.stop()
    _ultrasonic = null
  }

  return plugin
}
