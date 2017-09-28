#!/usr/bin/env node
const Docker = require('dockerode')
const docker = new Docker()
docker.on('error', function ignoreError () {

})
var joinedNetworkCounter = {}
function joinDockerNetwork (containerId, networkId, cb) {
  var net = docker.getNetwork(networkId)
  var cnt = docker.getContainer(containerId)
  net.connect({Container: cnt.id}, function (err, data) {
    var failed = false
    if (err && !/endpoint with name .* exists in network/.test(err.message)) {
      console.error('failed to join network ' + networkId + ' containerId: ' + containerId + ' ' + err.message)
    } else {
      failed = true
      console.log(' join network ' + networkId + ' containerId: ' + containerId, data)
    }
    if (failed) {
      cb(err, {containerId: containerId, networkId: networkId, data: data})
    } else {
      joinedNetworkCounter[networkId] = (joinedNetworkCounter[networkId] || 0) + 1
      cb(null, {containerId: containerId, networkId: networkId, data: data})
    }
  })
}

function disconnectDockerNetwork (containerId, networkId, cb) {
  if (joinedNetworkCounter[networkId] && joinedNetworkCounter[networkId] > 0) {
    joinedNetworkCounter[networkId] = joinedNetworkCounter[networkId] - 1
    return cb()
  }

  var net = docker.getNetwork(networkId)
  var cnt = docker.getContainer(containerId)
  net.disconnect({Container: cnt.id}, function (err, data) {
    if (err) {
      console.error('failed to disconnect network ' + networkId + ' containerId: ' + containerId + ' ' + err.message)
    } else {
      console.log(' disconnect network ' + networkId + ' containerId: ' + containerId, data)
    }
    cb(err, {containerId: containerId, networkId: networkId, data: data})
  })
}
module.exports = {
  joinDockerNetwork,
  disconnectDockerNetwork
}

