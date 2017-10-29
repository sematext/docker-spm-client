#!/usr/bin/env node
var os = require('os')
var RcYaml = require('rc-yaml-2')
var rcConfig = new RcYaml('spm')
var format = require('es6-template-strings')
var dockerNet = require('./joinDockerNetwork')
var SpmAgent = require('spm-agent')
var exec = require('child_process').execSync

const CHECK_SERVICE_RESTART_INTERVAL = 10000
var ld = require('lodash')
var runningAgents = {}
var configModified = 0
var containerIps = {}
var podIps = {}
var useKubernetesApi = false
var PodStatusMonitor = require('./podStatusMonitor')
var LRU = require('lru-cache')
var startEventCache = new LRU(1000)
var stopEventCache = new LRU(1000)

function spmServiceRestart () {
  // this should be scheduled every 10 seconds => CHECK_SERVICE_RESTART_INTERVAL=10000
  if (configModified > 0) {
    configModified = 0
    try {
      exec('service spm-monitor restart').toString()
    } catch (err) {
      console.error(err)
    }
  }
}

AutoDiscovery.prototype.dockerEventHandler = function (dockerEvent, containerInfo) {
  // overwrites config values by container Labels/Env - retruns a cloned config with modified values
  var appConfig = this.mergeConfig(containerInfo)
  appConfig.spmToken = this.getConfigValue('SPM_TOKEN', containerInfo) || appConfig.spmToken
  if (!appConfig.spmToken) {
    SpmAgent.Logger.info('No SPM_TOKEN set for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    SpmAgent.Logger.info('Skip monioring for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    return null
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
      if (containerInfo.NetworkSettings && containerInfo.NetworkSettings.Networks && containerInfo.NetworkSettings.Networks.length > 0) {
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
  }
  if (networkID !== null) {
    var spmClientContainerName = process.env.TEST_SPM_CID || os.hostname()
    dockerNet.joinDockerNetwork(spmClientContainerName, networkID, function () {})
  }
  return {
    host: host,
    port: port,
    networkID: networkID,
    appConfig: appConfig
  }
}

AutoDiscovery.prototype.kuberntesEventHandler = function (dockerEvent, containerInfo) {
  // overwrites config values by container Labels/Env - retruns a cloned config with modified values
  var appConfig = this.mergeConfig(containerInfo)
  appConfig.spmToken = this.getConfigValue('SPM_TOKEN', containerInfo) || appConfig.spmToken
  if (!appConfig.spmToken) {
    SpmAgent.Logger.info('No SPM_TOKEN set for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    SpmAgent.Logger.info('Skip monioring for image/container ' + containerInfo.Config.Image + containerInfo.Name)
    return null
  }
  if (appConfig.portInContainer) {
    port = appConfig.portInContainer.replace('/tcp', '').replace('/udp', '')
  }
  // java apps are monitored via JMX port
  if (appConfig.jmxPort) {
    port = appConfig.jmxPort
  }
  // console.log(containerInfo.NetworkSettings.Ports[appConfig.portInContainer])
  var host = containerInfo.NetworkSettings.IPAddress
  var port = 0
  var pod = containerIps[dockerEvent.id]
  if (pod) {
    host = pod.podIp
  }
  console.log('Container ID: ' + dockerEvent.id, 'PodIp:' + host)
  if (!pod) {
    console.error('no pod found for container ID: ' + dockerEvent.id)
    return null
  } else {
    this.setupAgent({
      host: host,
      port: port,
      appConfig: appConfig
    }, dockerEvent, containerInfo)
  }
}
AutoDiscovery.prototype.getConfigValue = function (key, containerInfo, prefix = '') {
  if (!prefix) {
    prefix = ''
  }
  if (containerInfo && containerInfo.Config && containerInfo.Config.Labels && containerInfo.Config.Environment) {
    return containerInfo.Config.Labels[key] || containerInfo.Config.Environment[key] || this.appConfig[key]
  } else {
    return this.appConfig[key]
  }
}
AutoDiscovery.prototype.mergeConfig = function (containerInfo) {
  // use a copy of original config to overwrite values later
  var appConfig = ld.cloneDeep(this.appConfig)
  var appConfigProperties = Object.keys(appConfig)
  appConfigProperties.forEach(function (property) {
    appConfig[property] = this.getConfigValue(property, containerInfo, 'com.sematext.spm.')
  }.bind(this))
  return appConfig
}

AutoDiscovery.prototype.setupAgent = function (socketInfo, dockerEvent, containerInfo) {
  if (!socketInfo) {
    console.error('no info')
    return
  }
  if (socketInfo.port > 0) {
    SpmAgent.Logger.info('Start monitoring container: ' + containerInfo.Name)
    // console.log(containerInfo)
    var templateContext = {
      globalConfig: this.globalConfig,
      config: socketInfo.appConfig,
      spmToken: socketInfo.appConfig.spmToken,
      containerId: dockerEvent.id,
      // sorry for upper case properties, but #golang/#docker uses uppercase JSON properties
      containerName: containerInfo.Name.replace(/\//, '').replace(/\:|\-|\s/g, '_'), // remove leading "/"
      containerEnv: containerInfo.Config.Environment,
      containerLabels: containerInfo.Config.Labels,
      container: containerInfo,
      dockerEvent: dockerEvent,
      host: socketInfo.host,
      port: socketInfo.port,
      podName: socketInfo.appConfig.pod ? socketInfo.appConfig.pod.podFullName : null,
      process: process
    }
    if (!templateContext.spmToken) {
      console.log('Missing SPM token for ' + containerInfo.Image + '/' + containerInfo.Name)
      return
    }
    templateContext.spmConfig = ''
    // generate -P:KEY:VALUE options for spm-client-setup.sh
    if (socketInfo.appConfig.spmConfig) {
      Object.keys(socketInfo.appConfig.spmConfig).forEach(function (key) {
        if (socketInfo.appConfig.spmConfig[key] !== null) {
          templateContext.spmConfig = templateContext.spmConfig + ' -P:' + key + '=' + format(socketInfo.appConfig.spmConfig[key], templateContext)
        }
      })
    }
    // generate setup command
    templateContext.spmSetup = format(socketInfo.appConfig.spmSetupTemplate, templateContext)
    var cmd = format('${spmSetup} ${spmConfig}', templateContext)
    console.log(cmd)
    try {
      console.log(exec(cmd).toString())
      runningAgents[dockerEvent.id] = {
        containerId: dockerEvent.id,
        spmToken: templateContext.spmToken,
        setupCmd: cmd,
        removeCmd: format(socketInfo.appConfig.spmRemoveTemplate, templateContext)
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

AutoDiscovery.prototype.start = function (dockerEvent, containerInfo) {
  // Docker events are faster than Kubernetes Events - we cache the Docker Events for later use
  var globalConfig = this.globalConfig
  startEventCache.set(dockerEvent.id, {containerInfo: containerInfo, dockerEvent: dockerEvent})
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
  if (!useKubernetesApi) {
    // Docker CE, Docker Swarm/EE
    var socketInfo = this.dockerEventHandler(dockerEvent, containerInfo)
    this.setupAgent(socketInfo, dockerEvent, containerInfo)
  }
}
function AutoDiscovery (globalConfig, appConfig, key) {
  this.globalConfig = globalConfig
  this.appConfig = appConfig
  this.appName = key

  var DockerDiscovery = require('./dockerDiscovery')
  console.log('Watching Docker Events for automatic application discovery for ' + key)
  this.dockerDiscovery = new DockerDiscovery({
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
        // no spm-client service restart required for Node.js based agents
        if (!/nginx|httpd|mongo|/.test(key)) {
          configModified = configModified + 1
        }
        SpmAgent.Logger.info('Stop monitoring for container ' + dockerEvent.id)
      }
      delete runningAgents[dockerEvent.id]
    }
  })
}
var autoDiscos = []

Object.keys(rcConfig.spmAppTemplates).forEach(function (key) {
  var autodisco = new AutoDiscovery(rcConfig, rcConfig.spmAppTemplates[key], key)
  autoDiscos.push(autodisco)
})

var stream = null
function restartPodMonitor () {
  stream = new PodStatusMonitor(containerIps, podIps)
  if (stream) {
    stream.on('error', this)
  }
}
console.log('Starting SPM auto discovery for Docker')

if (true || process.env.KUBERNETES_PORT_443_TCP) {
  useKubernetesApi = true
  console.log('Start watching Kuberntes POD status events')
  try {
    stream = new PodStatusMonitor(containerIps, podIps)
    if (stream) {
      // the stream is reduced to containerIDs all other info is in caches
      stream.on('data', function (data) {
        var dockerInfo = startEventCache.get(data.id)
        if (!dockerInfo) {
          console.error('no containerInfo for containerID: ' + data.id)
          return
        }
        autoDiscos.forEach(function (ad) {
          ad.kuberntesEventHandler(dockerInfo.dockerEvent, dockerInfo.containerInfo)
        })
      })
      stream.on('error', restartPodMonitor)
      setTimeout(function () {
        stream.start(containerIps, podIps)
      }, 2000)
    }
  } catch (err) {
    console.error(err)
  }
}

// check every 10 seconds if spm service needs a restart
setInterval(spmServiceRestart, CHECK_SERVICE_RESTART_INTERVAL)
process.on('uncaughtException', function (err) {
  console.error((new Date()).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})
