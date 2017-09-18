'use strict'
var dockerInspect = require('./dockerInspect')
var allContainer = require('docker-allcontainers')

function DockerDiscovery (options) {
  this.options = options
  this.emitter = allContainer({
    preheat: true, // emit starts event for all already running containers
    docker: null,  // options to Dockerode
    matchByImage: options.image,
    matchByName: options.container
    // skipByImage: /sematext-agent/
  })
  this.emitter.on('start', function (event) {
    // console.log('docker start', event.image )
    if (this.options && options.image && (options.image instanceof RegExp && this.options.startFunction) && options.image.test(event.image)) {
      dockerInspect.inspect(event.id, function (err, info) {
        if (!err) {
          info.Config.Environment = {}
          // transform array to dictionary
          info.Config.Env.forEach(function (value) {
            var s = value.split('=')
            info.Config.Environment[s[0]] = s[1]
          })
          this.options.startFunction(event, info)
        }
      }.bind(this))
    }
  }.bind(this))
  this.emitter.on('stop', function (event) {
    // console.log('docker stop', event.image )
    if (this.options && options.image && (options.image instanceof RegExp && this.options.stopFunction) && options.image.test(event.image)) {
      this.options.stopFunction(event)
    }
  }.bind(this))
}
module.exports = DockerDiscovery
