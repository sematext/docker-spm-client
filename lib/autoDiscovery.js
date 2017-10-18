#!/usr/bin/env node
var RcYaml = require('rc-yaml-2')
var rcConfig = new RcYaml('spm')
var format = require('es6-template-strings')
// require('string-template')
var dockerNet = require('./joinDockerNetwork')
console.log('Starting SPM auto discovery for Docker')
const CHECK_SERVICE_RESTART_INTERVAL = 10000
var exec = require('child_process').execSync
// should be done in run.sh ...

var SpmAgent = require('spm-agent')
var runningAgents = {}
var configModified = 0
var os = require('os')

var containerIps = {}
var podIps = {}
var useKubernetesApi = false

function monitorPodStatus () {
  var Api = null
  var core = null
  if (process.env.KUBERNETES_PORT_443_TCP) {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.getInCluster())
  } else {
    Api = require('kubernetes-client')
    core = new Api.Core(Api.config.fromKubeconfig())
  }
  const JSONStream = require('json-stream')
  const jsonStream = new JSONStream()

  const stream = core.ns.po.getStream({ qs: { watch: true } })
  stream.pipe(jsonStream)

  jsonStream.on('data', object => {
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
      console.log('Pod:', podFullName, podIp, containerIps)
    } else {
      console.log(object.type, JSON.stringify(object, null, '\t'))
    }
  })
  return jsonStream
}

function spmServiceRestart () {
  // this should scheduled every 10 seconds => CHECK_SERVICE_RESTART_INTERVAL=10000
  if (configModified > 0) {
    configModified = 0
    try {
      // console.log(
      exec('service spm-monitor restart').toString()
    // )
    } catch (err) {
      console.error(err)
    }
  }
}

AutoDiscovery.prototype.start = function (dockerEvent, containerInfo) {
  var globalConfig = this.globalConfig
  var appConfig = this.appConfig

  var spmToken = containerInfo.Config.Labels['SPM_TOKEN'] || containerInfo.Config.Environment['SPM_TOKEN'] || appConfig.spmToken
  if (globalConfig.debug.printEvents) {
    SpmAgent.Logger.info(dockerEvent)
  }
  if (globalConfig.debug.printContainerInfo) {
    SpmAgent.Logger.info(containerInfo)
  }
  if (globalConfig.debug.printContainerEnvironment) {
    SpmAgent.Logger.info(containerInfo.Config.Environment)
  }
  if (globalConfig.debug.printContainerLabels) {
    SpmAgent.Logger.info('Container labels', containerInfo.Config.Labels)
  }
  if (!spmToken) {
    SpmAgent.Logger.info('No SPM_TOKEN set for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    SpmAgent.Logger.info('Skip monioring for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    return
  }
  // console.log(containerInfo.NetworkSettings.Ports[appConfig.portInContainer])
  var host = containerInfo.NetworkSettings.IPAddress
  var port = 0
  var httpPort
  var httpsPort
  var networkID = null
  if (appConfig.containerNetwork === 'host') {
    SpmAgent.Logger.info('Using host network: ' + appConfig.dockerNetwork)
    if (containerInfo.NetworkSettings.Ports &&
      containerInfo.NetworkSettings.Ports[appConfig.sslPortInContainer] &&
      containerInfo.NetworkSettings.Ports[appConfig.sslPortInContainer].length > 0) {
      host = containerInfo.NetworkSettings.Ports[httpsPort][0].HostIp
      port = containerInfo.NetworkSettings.Ports[httpsPort][0].HostPort
    }
    if (containerInfo.NetworkSettings.Ports &&
      containerInfo.NetworkSettings.Ports[appConfig.portInContainer] &&
      containerInfo.NetworkSettings.Ports[appConfig.portInContainer].length > 0) {
      host = containerInfo.NetworkSettings.Ports[httpPort][0].HostIp
      port = containerInfo.NetworkSettings.Ports[httpPort][0].HostPort
    }
  } else {
    // connect via container network e.g. bridge
    // TODO: integrate join docker network
    SpmAgent.Logger.info('Using container network (' + (appConfig.dockerNetwork || 'default/bridge') + ')')
    if (appConfig.portInContainer) {
      port = appConfig.portInContainer.replace('/tcp', '').replace('/udp', '')
    } else if (appConfig.jmxPort) {
      port = appConfig.jmxPort
    }
    if (containerInfo.NetworkSettings.IPAddress && containerInfo.NetworkSettings.IPAddress.length > 6) {
      // bridge network?
      host = containerInfo.NetworkSettings.IPAddress
    } else {
      // iterate over networks, assuming network[0] is the default
      var networks = Object.keys(containerInfo.NetworkSettings.Networks)
      if (networks && networks.length > 0 && containerInfo.NetworkSettings.Networks[networks[0]].IPAMConfig &&
        containerInfo.NetworkSettings.Networks[networks[0]].IPAMConfig.IPv4Address) {
        host = containerInfo.NetworkSettings.Networks[networks[0]].IPAMConfig.IPv4Address
        networkID = containerInfo.NetworkSettings.Networks[networks[0]].NetworkID
      } else if (networks && networks.length > 0 && containerInfo.NetworkSettings.Networks[networks[0]] &&
        networks && networks.length > 0 && containerInfo.NetworkSettings.Networks[networks[0]].IPAddress) {
        host = containerInfo.NetworkSettings.Networks[networks[0]].IPAddress
        networkID = containerInfo.NetworkSettings.Networks[networks[0]].NetworkID
      } else if (containerInfo.HostConfig.NetworkMode && containerInfo.HostConfig.NetworkMode.length > 0 && containerInfo.NetworkSettings.Networks[containerInfo.HostConfig.NetworkMode]) {
        SpmAgent.Logger.info('Using container network ' + containerInfo.HostConfig.NetworkMode + ' ' + containerInfo.NetworkSettings.Networks[containerInfo.HostConfig.NetworkMode].IPAddress)
        host = containerInfo.NetworkSettings.Networks[containerInfo.HostConfig.NetworkMode].IPAddress
        networkID = containerInfo.NetworkSettings.Networks[containerInfo.HostConfig.NetworkMode].NetworkID
      }
    }
  }
  if (networkID !== null) {
    var spmClientContainerName = process.env.TEST_SPM_CID || os.hostname()
    dockerNet.joinDockerNetwork(spmClientContainerName, networkID, function () {})
  }
  if (useKubernetesApi) {
    host = containerIps[dockerEvent.id.replace('/', '')]
    console.log('Container ID: ' + dockerEvent.id, host)
  }
  if (port > 0) {
    SpmAgent.Logger.info('Start monitoring container: ' + containerInfo.Name)
    // console.log(containerInfo)
    var templateContext = {
      globalConfig: globalConfig,
      config: appConfig,
      spmToken: spmToken,
      containerId: dockerEvent.id,
      // sorry for upper case properties, but #golang/#docker uses uppercase JSON properties
      containerName: containerInfo.Name.replace(/\//, '').replace(/\:|\-|\s/g, '_'), // remove leading "/"
      containerEnv: containerInfo.Config.Environment,
      containerLabels: containerInfo.Config.Labels,
      container: containerInfo,
      dockerEvent: dockerEvent,
      host: host,
      port: port,
      process: process
    }
    if (!templateContext.spmToken) {
      console.log('Missing SPM token for ' + containerInfo.Image + '/' + containerInfo.Name)
      return
    }
    templateContext.spmConfig = ''
    // generate -P:KEY:VALUE options for spm-client-setup.sh
    if (appConfig.spmConfig) {
      Object.keys(appConfig.spmConfig).forEach(function (key) {
        if (appConfig.spmConfig[key] !== null) {
          templateContext.spmConfig = templateContext.spmConfig + ' -P:' + key + '=' + format(appConfig.spmConfig[key], templateContext)
        }
      })
    }
    // generate setup command
    templateContext.spmSetup = format(appConfig.spmSetupTemplate, templateContext)
    var cmd = format('${spmSetup} ${spmConfig}', templateContext)
    console.log(cmd)
    try {
      console.log(exec(cmd).toString())
      runningAgents[dockerEvent.id] = {
        containerId: dockerEvent.id,
        spmToken: templateContext.spmToken,
        setupCmd: cmd,
        removeCmd: format(appConfig.spmRemoveTemplate, templateContext)
      }
      console.log(dockerEvent.id, runningAgents[dockerEvent.id])
      // no spm-client service restart required for Node.js based agents
      if (!/nginx|httpd|mongo|/.test(containerInfo.Image)) {
        configModified = configModified + 1
      }
    } catch (err) {
      SpmAgent.Logger.error(err)
    }
  }
}
function AutoDiscovery (globalConfig, appConfig, key) {
  this.globalConfig = globalConfig
  this.appConfig = appConfig

  var DockerDiscovery = require('./dockerDiscovery')
  console.log('Watching Docker Events for automatic application discovery for ' + key)
  var dockerDiscovery = new DockerDiscovery({
    image: new RegExp(appConfig.matchImageName),
    container: new RegExp(appConfig.matchContainerName),
    startFunction: this.start.bind(this),
    stopFunction: function (dockerEvent, containerInfo) {
      if (globalConfig.debug.printEvents) {
        SpmAgent.Logger.info(dockerEvent)
      }
      var agent = runningAgents[dockerEvent.id]
      if (agent) {
        console.log(agent.removeCmd)
        try {
          exec(agent.removeCmd)
        } catch (execError) {
          console.error(execError)
        }
        configModified = configModified + 1
        SpmAgent.Logger.info('Stop monitoring for container ' + dockerEvent.id)
      }
      delete runningAgents[dockerEvent.id]
    }
  })
}
// activate all apps for auto-discovery
Object.keys(rcConfig.spmAppTemplates).forEach(function (key) {
  var autodisco = new AutoDiscovery(rcConfig, rcConfig.spmAppTemplates[key], key)
})

// check every 10 seconds if spm service needs a restart
setInterval(spmServiceRestart, CHECK_SERVICE_RESTART_INTERVAL)
process.on('uncaughtException', function (err) {
  console.error((new Date()).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})
var stream = null
function restartPodMonitor () {
  stream = monitorPodStatus()
  stream.on('error', this)
}
if (process.env.KUBERNETES_PORT_443_TCP) {
  useKubernetesApi = true
  try {
    stream = monitorPodStatus()
    stream.on('error', restartPodMonitor)
  } catch (err) {

  }
}
