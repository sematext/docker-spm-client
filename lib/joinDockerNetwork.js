#!/usr/bin/env node
const Docker = require('dockerode')
const docker = new Docker()
function joinDockerNetwork (containerId, networkId, cb) {
  var net = docker.getNetwork(networkId)
  var cnt = docker.getContainer(containerId)
  net.connect({Container: cnt.id}, function (err, data) {
    if (err) {
      console.error('failed to join network ' + networkId + ' containerId: ' + containerId)
    } else {
      console.log(' join network ' + networkId + ' containerId: ' + containerId, data)
    }
    cb(err, {containerId: containerId, networkId: networkId, data: data})
  })
}
module.exports = joinDockerNetwork
