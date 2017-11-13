var JSONStream = require('json-stream')
var util = require('util')
var EventEmitter = require('events').EventEmitter

function MonitorPodStatus (containerIps, podIps) {
  this.containerIps = containerIps
  this.podIps = podIps
}

MonitorPodStatus.prototype.start = function (containerIps, podIps) {
  var Api = null
  var core = null
  var self = this
  if (process.env.KUBERNETES_PORT_443_TCP) {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.getInCluster())
  } else {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.fromKubeconfig())
  }
  this.jsonStream = new JSONStream()
  var stream = core.pods.get({qs: { watch: true }})
  stream.pipe(this.jsonStream)
  this.jsonStream.on('error', function (err) {
    this.emit('error', err)
  }.bind(this))

  this.jsonStream.on('data', object => {
    if (process.env.DEBUG === 'true') {
      // console.log(object.type, object.object.metadata.name)
      // JSON.stringify(object.object, null, '\t'))
    }
    if ((object.type === 'ADDED' || object.type === 'DELETED' || object.type === 'MODIFIED') && object.object && object.object.status && object.object.metadata) {
      var podIp = undefined
      if (object.object.status) {
        podIp = object.object.status.podIP
      }
      if (!podIp && (object.type === 'ADDED' || object.type === 'MODIFIED')) {
        // ignore ADDED & MODIFIED events withput IP address
        return
      }
      if (process.env.DEBUG === 'true') {
        console.log(object.type, object.object.metadata.name, podIp)
        if (process.env.DEBUG_K8S_EVENTS === 'true') {
          console.log(JSON.stringify(object.object, null, '  '))
        }
      }
      var podName = object.object.metadata.name
      var nameSpace = object.object.metadata.namespace
      var podFullName = nameSpace + '_' + podName

      var containerIDs = []
      if (object.object.status.containerStatuses) {
        object.object.status.containerStatuses.forEach(function (c) {
          if (!c) {
            return
          }
          if (!c.containerID) {
            // each container should have containerID
            // console.error('Contianer without ID:', JSON.stringify(c))
            return
          }
          var containerID = c.containerID.replace('docker://', '')
          if (object.type === 'ADDED' || object.type === 'MODIFIED') {
            containerIDs.push(containerID)
            containerIps[containerID] = {podIp: podIp, podName: podFullName}
            podIps[podFullName] = podIp
            self.emit('data', {id: containerID})
          }
          if (object.type === 'DELETED') {
            delete containerIps[containerID]
            if (podIps[podFullName]) {
              delete podIps[podFullName]
            }
          }
        })
      }
    } else {
      console.log(object.type, JSON.stringify(object, null, '\t'))
    }
  })
  return this
}
util.inherits(MonitorPodStatus, EventEmitter)
module.exports = MonitorPodStatus
