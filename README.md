# Signal K Calypso Ultrasonic plugin

> Signal K plugin for connecting to and receiving wind data from a Calypso Ultrasonic wireless wind instrument.


## Installation & usage (as Signal K plugin)
Install this plugin using the Signal K app store or install it manually in the Signal K server directory:

```
npm install signalk-calypso-ultrasonic
```

After installation, you enable & configure the plugin via the plugins page in the Signal K admin UI.


## Installation & usage (standalone)
It's possible to use this plugin standalone, or as part of another application. Install the plugin using NPM:

```
npm install --save signalk-calypso-ultrasonic
```

After installation, run the factory method and then you can use the `Ultrasonic` class manually:

```javascript
const { Ultrasonic } = require('signalk-calypso-ultrasonic')()

const ultrasonic = new Ultrasonic({
  setRate: 4, // Hz
  setCompass: 1, // Turn on compass/9DOF sensor
  maxRetries: Infinity
})

ultrasonic.on('delta', delta => handleDeltaMessage(delta))
ultrasonic.on('data', data => handleDataMessage(data))
```

The class accepts the following options:

- `setRate: enum{ false, 1, 4, 8 }`; set an update rate in Hz or leave as is (false)
- `setCompass: enum{ false, 0, 1 }`; set the state of the 9DOF sensor/compass or leave as is (false)
- `maxRetries: Number`; set the number of connection retries (default = `Infinity`)
- `timeout: fn`; a function used to calculate the backoff time (default: `(retries) => (retries / 2) * 500`)
- `name: String{ULTRASONIC}`; the name of the device used to detect the Ultrasonic. Don't change unless you have a different version with a different name.

The class emits the folowing events:

- `delta`: a Signal K delta message (see below)
- `data`: the decoded data model in intermediate (plain object) format. The model has the following keys: `windSpeedApparent`, `windAngleApparent`, `batteryLevel`, `temperature`, `roll`, `pitch`, `compass`, `timestamp`; where each value is represented in SI units (i.e. Kelvin for temperature, radians for angles and m/s for velocity). Battery level is a float between 0-1.


## Signal K delta output

The Ultrasonic decoder outputs Signal K delta messages. [Read this](http://signalk.org/specification/1.0.4/doc/data_model.html#delta-format) for more info on the delta format. Depending on wether the 9DOF/compass sensor is enabled, the following paths are emitted. Values are, as per the Signal K specification, represented in SI units (i.e. Kelvin for temperature, radians for angles and m/s for velocity). Battery level is a float between 0-1.

- `environment/outside/temperature`
- `environment/wind/angleApparent`
- `environment/wind/speedApparent`
- `electrical/batteries/99/name`
- `electrical/batteries/99/location`
- `electrical/batteries/99/capacity/stateOfCharge`
- `navigation/attitude/roll`
- `navigation/attitude/pitch`
- `navigation/attitude/yaw`
- `navigation/headingMagnetic`

All values/paths are emitted in the `self` context.


## @TODO
- [x] Signal K plugin skeleton + config for writing flags
- [x] Writing flags to the device if they were set in config
- [ ] Figure out if we should be using `environment/wind/angleApparent` or `environment/wind/directionMagnetic` ?
- [ ] Figure out how to implement unit tests that don't rely on an actual device


## License

Copyright 2018 Fabian Tollenaar/Decipher Industries <fabian@decipher.industries> (https://decipher.industries)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
