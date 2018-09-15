const { Ultrasonic } = require('../lib/ultrasonic')()

const ultrasonic = new Ultrasonic({
  setRate: 4, // Hz
  setCompass: 1, // Turn on compass/9DOF sensor
  maxRetries: Infinity
})

ultrasonic.on('delta', delta => handleMessage(delta))
// ultrasonic.on('data', data => handleMessage(data))
ultrasonic.start()

function handleMessage (msg) {
  console.log('GOT MESSAGE: ' + JSON.stringify(msg))
}
