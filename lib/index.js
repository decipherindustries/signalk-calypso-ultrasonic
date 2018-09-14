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

const Ultrasonic = require('./ultrasonic')
const ultrasonic = new Ultrasonic({
  setRate: 1,
  setCompass: 0
})

ultrasonic.on('delta', model => {
  console.log('Got delta: ' + JSON.stringify(model, null, 2))
})

ultrasonic.start()
