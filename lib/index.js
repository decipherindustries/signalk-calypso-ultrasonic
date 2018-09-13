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

const debug = require('debug')('signalk-calypso-ultrasonic')
const noble = require('noble')

const MODES = {
  0: 'SLEEP_MODE',
  1: 'LOW_POWER_MODE',
  2: 'NORMAL_MODE'
}

const DEVICE_INFO = {
  '2A29': 'Manufacturer',
  '2A24': 'Model',
  '2A25': 'Serial number',
  '2A27': 'HW revision',
  '2A26': 'FW revision',
  '2A28': 'SW revision'
}

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

const NS = {
  peripheral: null,
  connected: false,
  mode: 2,
  speed: 1,
  compass: 0,
  calibration: 0,
  windSpeedMultiplier: 0,
  subscribed: false,

  handleDiscoveredPeripheral (peripheral) {
    if (!Object.isObject(peripheral, 'advertisement') || !Object.isObject(peripheral.advertisement, 'localName')) {
      return
    }

    if (String(peripheral.advertisement.localName).toUpperCase() === 'ULTRASONIC') {
      debug(`Found Ultrasonic, connecting...`)
      this.peripheral = peripheral
      noble.stopScanning()
      this.connect()
    }
  },

  connect () {
    if (this.peripheral === null) {
      return
    }

    this.peripheral.connect(err => {
      if (err) {
        debug(`Error connecting to ultrasonic: ${err.message}`)
      }

      debug(`Connected to Ultrasonic, discovering services and characteristics...`)
      this.connected = true
      this.peripheral.discoverAllServicesAndCharacteristics(this.characteristics.bind(this))
    })
  },

  characteristics (err, services, characteristics) {
    if (err) {
      return debug(`Error discovering services/characteristics: ${err.message}`)
    }

    characteristics.forEach(characteristic => {
      if (!Object.isObject(characteristic, 'uuid')) {
        return
      }

      const uuid = String(characteristic.uuid).toUpperCase()
      characteristic.read(this.handleCharacteristicRead(uuid))

      if (this.subscribed === false && uuid === '2A39') {
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
  },

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
          return debug(`Device - ${DEVICE_INFO[uuid]}: ${data.toString('ascii')}`)

        case '2A39':
          return this.decode(data)

        case 'A001':
          this.mode = data.readUInt8(0)
          return debug(`Ultrasonic operating mode = ${MODES[this.mode]}`)

        case 'A002':
          this.speed = data.readUInt8(0)
          return debug(`Ultrasonic sampling speed = ${this.speed}`)

        case 'A003':
          this.compass = data.readUInt8(0)
          return debug(`Ultrasonic compass state = ${this.compass === 1 ? 'ON' : 'OFF'}`)

        case 'A007':
          this.windAngleOffset = data.readUInt16LE(0)
          return debug(`Ultrasonic wind angle offset = ${this.windAngleOffset}`)

        case 'A008':
          this.calibration = data.readUInt8(0)
          return debug(`Ultrasonic compass calibration = ${this.calibration === 1 ? 'ON' : 'OFF'}`)

        case 'A009':
          this.windSpeedMultiplier = data.readFloatLE(0)
          return debug(`Ultrasonic wind speed multiplier = ${this.windSpeedMultiplier} (${data.toString('hex')})`)
      }
    }
  },

  decode (buf) {
    const data = buf.toString('hex').match(/.{1,2}/g)
    const model = {
      windSpeed: buf.readUInt16LE(0) / 100,
      windDirection: buf.readUInt16LE(2),
      batteryLevel: buf.readUInt8(4) * 10,
      temperature: buf.readUInt8(5) - 100,
      roll: this.compass === 0 ? null : buf.readUInt8(6) - 90,
      pitch: this.compass === 0 ? null : buf.readUInt8(7) - 90,
      compass: this.compass === 0 ? null : 360 - buf.readUInt16LE(8),
      timestamp: new Date().toISOString()
    }

    debug(`Ultrasonic data (${data}): ${JSON.stringify(model, null, 2)}`)
  },

  start () {
    noble.on('discover', this.handleDiscoveredPeripheral.bind(this))
    noble.startScanning([], false, err => {
      if (err) {
        debug(`Encountered a scanning error: ${err.message}`)
      }
    })
  },

  stop () {
    // Tear-down
    noble.removeAllListeners()
    noble.stopScanning()
  }
}

NS.start()
