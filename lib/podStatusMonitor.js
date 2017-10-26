var JSONStream = require('json-stream')

function monitorPodStatus (containerIps, podIps) {
  var Api = null
  var core = null
  if (process.env.KUBERNETES_PORT_443_TCP) {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.getInCluster())
  } else {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.fromKubeconfig())
  }
  const jsonStream = new JSONStream()
  var stream = core.pods.get({ qs: { watch: true }})
  stream.pipe(jsonStream)

  jsonStream.on('data', object => {
    console.log(JSON.stringify(object.object,null, '\t'))
    if ((object.type === 'ADDED' || object.type === 'DELETED' || object.type === 'MODIFIED') && object.object && object.object.status && object.object.metadata) {
      var podIp = object.object.status.podIP

      if (object.type === 'MODIFIED' && !podIp) {
        return
      }
      var podName = object.object.metadata.name
      var nameSpace = object.object.metadata.name
      var podFullName = nameSpace + '_' + podName

      var containerIDs = []
      if (object.object.status.containerStatuses) {
        object.object.status.containerStatuses.forEach(function (c) {
          if (process.env.DEBUG === "true") {
            console.log(c)
          }
          if (!c) {
            return
          }
          if (!c.containerID) {
            // each container should have containerID
            console.error ('Contianer without ID:', JSON.stringify(c))
            return
          }
          var containerID = c.containerID.replace('docker://', '')        
          if (object.type === 'ADDED') {
            containerIDs.push(containerID)
            containerIps[containerID] = {podIp: podIp, podName: podFullName}
            podIps[podFullName] = podIp
          }
          if (object.type === 'DELETED') {
            delete containerIps[containerID]
            if (podIps[podFullName]) {
              delete podIps[podFullName]
            }
          }
        })
      }
      if (process.env.DEBUG === 'true') {
        console.log('Pod:', podFullName, podIp, containerIps)
      }
    } else {
      console.log(object.type, JSON.stringify(object, null, '\t'))
    }
  })
  return jsonStream
}

module.exports = monitorPodStatus