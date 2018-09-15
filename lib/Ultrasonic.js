/**
 * signalk-calypso-ultrasonic
 *
 * @description   Signal K node.js server plugin to configure and read data from
 *                a Calypso Instruments wireless (BLE) ultrasonic anemometer
 * @module        signalk-calypso-ultrasonic
 * @author        Fabian Tollenaar <fabian@decipher.industries> (https://decipher.industries)
 * @copyright     Fabian Tollenaar, Decipher Industries & the Signal K organisation, 2018
 * @license       Apache-2.0
 */

const EventEmitter = require('events')
const debug = require('debug')('signalk-calypso-ultrasonic')
const noble = require('noble')

class Ultrasonic extends EventEmitter {
  constructor (opts) {
    super()
    this.options = Object.assign({
      setRate: false,
      setCompass: false,
      setAngleOffset: false,
      setWindSpeedCorrection: false,
      maxRetries: Infinity,
      timeout: (retries) => (retries / 2) * 500,
      name: 'ULTRASONIC'
    }, opts)

    this.shouldRetry = true
    this.peripheral = null
    this.connected = false
    this.mode = 2
    this.speed = 4
    this.compass = 0
    this.calibration = 0
    this.windSpeedMultiplier = 0
    this.subscribed = false
    this.retries = 0
    this.connectTimeout = null

    this.MODES = {
      0: 'SLEEP_MODE',
      1: 'LOW_POWER_MODE',
      2: 'NORMAL_MODE'
    }

    this.DEVICE_INFO = {
      '2A29': 'Manufacturer',
      '2A24': 'Model',
      '2A25': 'Serial number',
      '2A27': 'HW revision',
      '2A26': 'FW revision',
      '2A28': 'SW revision'
    }
  }

  get (datapoint) {
    if (this.hasOwnProperty(datapoint)) {
      return this[datapoint]
    }
  }

  start () {
    this.search()
  }

  stop () {
    this.shouldRetry = false
    this.retry()
  }

  retry () {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }

    noble.removeAllListeners()
    this.removeAllListeners()
    this.stopScanning()

    if (this.retries >= this.options.maxRetries || this.shouldRetry === false) {
      return
    }

    this.retries += 1
    const timeout = this.options.timeout(this.retries)
    this.emit('status', { status: 'retrying', data: this.retries })

    debug(`Waiting ${timeout} ms until retry`)
    setTimeout(() => this.search(), timeout)
  }

  search () {
    debug(`Starting search for Ultrasonic...`)
    this.emit('status', { status: 'searching', data: '' })
    noble.on('discover', this.foundPeripheral.bind(this))
    noble.startScanning([], false, err => {
      if (err) {
        debug(`Error searching error: ${err.message}`)
      }
    })

    if (this.connectTimeout === null) {
      this.connectTimeout = setTimeout(() => this.retry(), 120000)
    }
  }

  foundPeripheral (peripheral) {
    if (!Object.isObject(peripheral, 'advertisement') || !Object.isObject(peripheral.advertisement, 'localName')) {
      return
    }

    if (String(peripheral.advertisement.localName).toUpperCase() === this.options.name) {
      this.emit('status', { status: 'found_ultrasonic', data: '' })
      debug(`Found Ultrasonic, connecting...`)
      this.peripheral = peripheral
      this.stopScanning()
      this.connect()
    }
  }

  connect () {
    if (this.peripheral === null) {
      return
    }

    this.emit('status', { status: 'connecting', data: '' })
    this.peripheral.connect(err => {
      if (err) {
        debug(`Error connecting to Ultrasonic: ${err.message}`)
      }

      if (this.connectTimeout !== null) {
        debug('Clearing connectTimeout')
        clearTimeout(this.connectTimeout)
        this.connectTimeout = null
      }

      debug(`Connected to Ultrasonic, discovering services and characteristics...`)
      this.emit('status', { status: 'connected', data: '' })
      this.connected = true
      this.peripheral.discoverAllServicesAndCharacteristics(this.characteristics.bind(this))
    })
  }

  characteristics (err, services, characteristics) {
    if (err) {
      return debug(`Error discovering services/characteristics: ${err.message}`)
    }

    characteristics.forEach(characteristic => {
      if (!Object.isObject(characteristic, 'uuid')) {
        return
      }

      const uuid = String(characteristic.uuid).toUpperCase()
      let buf = null

      this.emit('status', { status: 'received_characteristic', data: uuid })

      if (uuid === 'A002' && (this.options.setRate === 1 || this.options.setRate === 4 || this.options.setRate === 8)) {
        buf = Buffer.alloc(1)
        buf.writeUInt8(this.options.setRate)
        debug(`Writing setSize = ${this.options.setRate} to ${uuid}: ${buf.toString('hex')}`)
        characteristic.write(buf)
      }

      if (uuid === 'A003' && (this.options.setCompass === 0 || this.options.setCompass === 1)) {
        buf = Buffer.alloc(1)
        buf.writeUInt8(this.options.setCompass)
        debug(`Writing setCompass = ${this.options.setCompass} to ${uuid}: ${buf.toString('hex')}`)
        characteristic.write(buf)
      }

      /* @TODO need to figure out if this is correct
      if (uuid === 'A007' && this.options.setAngleOffset !== false && typeof this.options.setAngleOffset === 'number' && !isNaN(this.options.setAngleOffset)) {
        buf = Buffer.alloc(2)
        buf.writeInt16LE(this.options.setAngleOffset)
        characteristic.write(buf)
      }

      if (uuid === 'A009' && this.options.setWindSpeedCorrection !== false && typeof this.options.setWindSpeedCorrection === 'number' && !isNaN(this.options.setWindSpeedCorrection)) {
        buf = Buffer.alloc(4)
        buf.writeInt32LE(this.options.setWindSpeedCorrection)
        characteristic.write(buf)
      }
      // */

      characteristic.read(this.handleCharacteristicRead(uuid))

      if (this.subscribed === false && uuid === '2A39') {
        this.emit('status', { status: 'subscribed_to_dataservice', data: uuid })
        this.subscribed = true
        characteristic.on('data', buf => this.decode(buf))
        characteristic.subscribe(err => {
          if (err) {
            this.subscribed = false
            characteristic.removeAllListeners('data')
            return debug(`Couldn't subscribe to data service: ${err.message}`)
          }
        })
      }
    })
  }

  handleCharacteristicRead (uuid) {
    return (err, data) => {
      if (err) {
        return debug(`Error reading characteristic ${uuid} data: ${err.message}`)
      }

      switch (uuid) {
        case '2A29':
        case '2A24':
        case '2A25':
        case '2A27':
        case '2A26':
        case '2A28':
          this.emit('deviceInfo', { kind: this.DEVICE_INFO[uuid], value: data.toString('ascii') })
          return debug(`Device - ${this.DEVICE_INFO[uuid]}: ${data.toString('ascii')}`)

        case '2A39':
          return this.decode(data)

        case 'A001':
          this.mode = data.readUInt8(0)
          this.emit('deviceInfo', {
            kind: 'Operating mode',
            value: this.mode
          })
          return debug(`Ultrasonic operating mode = ${this.MODES[this.mode]}`)

        case 'A002':
          this.speed = data.readUInt8(0)
          this.emit('deviceInfo', {
            kind: 'Sampling speed',
            value: this.speed
          })
          return debug(`Ultrasonic sampling speed = ${this.speed}`)

        case 'A003':
          this.compass = data.readUInt8(0)
          this.emit('deviceInfo', {
            kind: 'Compass state',
            value: this.compass
          })
          return debug(`Ultrasonic compass state = ${this.compass === 1 ? 'ON' : 'OFF'}`)

        case 'A007':
          this.windAngleOffset = data.readUInt16LE(0)
          this.emit('deviceInfo', {
            kind: 'Wind angle offset',
            value: this.windAngleOffset
          })
          return debug(`Ultrasonic wind angle offset = ${this.windAngleOffset}`)

        case 'A008':
          this.calibration = data.readUInt8(0)
          return debug(`Ultrasonic compass calibration = ${this.calibration === 1 ? 'ON' : 'OFF'}`)

        case 'A009':
          this.windSpeedMultiplier = data.readFloatLE(0)
          this.emit('deviceInfo', {
            kind: 'Wind speed multiplier',
            value: this.windSpeedMultiplier
          })
          return debug(`Ultrasonic wind speed multiplier = ${this.windSpeedMultiplier} (${data.toString('hex')})`)
      }
    }
  }

  decode (buf) {
    const data = buf.toString('hex').match(/.{1,2}/g)
    const model = {
      windSpeedApparent: buf.readUInt16LE(0) / 100,
      windAngleApparent: this.degreesToRadians(buf.readUInt16LE(2)),
      batteryLevel: parseFloat(((buf.readUInt8(4) * 10) / 100).toFixed(2)),
      temperature: this.celciusToKelvin(buf.readUInt8(5) - 100),
      roll: this.compass === 0 ? null : this.degreesToRadians(buf.readUInt8(6) - 90),
      pitch: this.compass === 0 ? null : this.degreesToRadians(buf.readUInt8(7) - 90),
      compass: this.compass === 0 ? null : this.degreesToRadians(360 - buf.readUInt16LE(8)),
      timestamp: new Date().toISOString()
    }

    debug(`Ultrasonic data (${data}): ${JSON.stringify(model, null, 2)}`)

    this.emit('data', model)
    this.generateDelta(model)
  }

  celciusToKelvin (val) {
    return val + 273.15
  }

  degreesToRadians (val) {
    return val * Math.PI / 180
  }

  generateDelta (model) {
    const values = [
      {
        path: 'environment.outside.temperature',
        value: model.temperature
      },
      {
        path: 'environment.wind.angleApparent',
        value: model.windAngleApparent
      },
      {
        path: 'environment.wind.speedApparent',
        value: model.windSpeedApparent
      },
      {
        path: 'electrical.batteries.99.name',
        value: 'ULTRASONIC'
      },
      {
        path: 'electrical.batteries.99.location',
        value: 'Mast'
      },
      {
        path: 'electrical.batteries.99.capacity.stateOfCharge',
        value: model.batteryLevel
      }
    ]

    if (model.roll !== null) {
      values.push({
        path: 'navigation.attitude.roll',
        value: model.roll
      })
    }

    if (model.pitch !== null) {
      values.push({
        path: 'navigation.attitude.pitch',
        value: model.roll
      })
    }

    if (model.compass !== null) {
      values.push({
        path: 'navigation.attitude.yaw',
        value: model.compass
      })

      values.push({
        path: 'navigation.headingMagnetic',
        value: model.compass
      })
    }

    const delta = {
      context: 'self',
      updates: [{
        source: {
          label: 'Calypso Ultrasonic',
          type: 'Ultrasonic'
        },
        timestamp: model.timestamp,
        values
      }]
    }

    this.emit('delta', delta)
  }

  stopScanning () {
    noble.stopScanning()
  }
}

module.exports = Ultrasonic

Object.isObject = function isObject (mixed, prop, isArr) {
  const isObj = mixed && typeof mixed === 'object'

  if (typeof prop === 'string' && typeof isArr === 'boolean') {
    return (isObj && Array.isArray(mixed[prop]) === isArr)
  }

  if (typeof prop === 'string') {
    return (isObj && mixed.hasOwnProperty(prop))
  }

  return isObj
}
