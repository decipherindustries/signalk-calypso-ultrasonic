const Ultrasonic = require('./lib/calypso-ultrasonic')

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
    subscribed_to_dataservice: 'Subscribed to data service',
    sleeping: 'Ultrasonic in sleep mode...'
  }

  plugin.Ultrasonic = Ultrasonic
  plugin.id = 'calypso-ultrasonic'
  plugin.name = 'Calypso Ultrasonic plugin for Signal K'
  plugin.description = plugin.name

  plugin.schema = {
    type: 'object',
    required: [
      'setRate',
      'setCompass',
      'maxRetries',
      'turnOnHour',
      'turnOffHour'
    ],
    properties: {
      setRate: {
        type: 'number',
        title: 'Update rate (Hz)',
        default: 1
      },
      setCompass: {
        type: 'number',
        title: 'Compass/9-DOF sensor state',
        default: 0
      },
      maxRetries: {
        type: 'number',
        title: 'Max. number of connection retries (0 = infinite)',
        default: 0
      },
      turnOnHour: {
        type: 'number',
        title: 'Hour of the day when the Ultrasonic should be awake (e.g. 6 => 6am)',
        default: 7
      },
      turnOffHour: {
        type: 'number',
        title: 'Hour of the day when the Ultrasonic should go to sleep (e.g. 21 => 9pm)',
        default: 20
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
      maxRetries: Infinity,
      turnOffHour: 20,
      turnOnHour: 7
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

      if (options.hasOwnProperty('turnOffHour') && !isNaN(options.turnOffHour)) {
        opts.turnOffHour = options.turnOffHour
      }

      if (options.hasOwnProperty('turnOnHour') && !isNaN(options.turnOnHour)) {
        opts.turnOnHour = options.turnOnHour
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
    _ultrasonic.disconnect()
    _ultrasonic.stop()
    _ultrasonic.removeAllListeners()
    _ultrasonic = null
  }

  return plugin
}
