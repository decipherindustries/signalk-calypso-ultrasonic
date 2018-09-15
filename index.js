const Ultrasonic = require('./lib/ultrasonic')

module.exports = function signalkCalypsoUltrasonic (app) {
  const plugin = {}
  let _ultrasonic = null

  plugin.STATUS = {
    retrying: 'Retrying to connect, retry',
    searching: 'Searching for Ultrasonic',
    found_ultrasonic: 'Found Ultrasonic',
    connecting: 'Connecting...',
    connected: 'Connected to Ultrasonic',
    received_characteristic: 'Received characteristic',
    subscribed_to_dataservice: 'Subscribed to data service'
  }

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

    if (options && typeof options === 'object') {
      if (options.hasOwnProperty('setRate') && (options.setRate === 1 || options.setRate === 4 || options.setRate === 8)) {
        opts.setRate = options.setRate
      }

      if (options.hasOwnProperty('setCompass') && (options.setCompass === 1 || options.setCompass === 0)) {
        opts.setCompass = options.setCompass
      }

      if (options.hasOwnProperty('maxRetries') && !isNaN(options.maxRetries)) {
        opts.setCompass = options.maxRetries > 0 ? options.maxRetries : Infinity
      }
    }

    _ultrasonic = new plugin.Ultrasonic(opts)

    _ultrasonic.on('delta', delta => {
      // console.log('SENDING DELTA', JSON.stringify(delta))
      app.handleMessage(plugin.id, delta)
    })

    _ultrasonic.on('status', status => {
      app.setProviderStatus(`${plugin.STATUS[status.status]}${status.data === '' ? '' : `: ${status.data}`}`)
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
