#!/usr/bin/env node
var RcYaml = require('rc-yaml-2')
var rcConfig = new RcYaml('spm')
var format = require('es6-template-strings')
// require('string-template')

console.log('Starting SPM auto discovery for Docker')
const CHECK_SERVICE_RESTART_INTERVAL = 10000
var exec = require('child_process').execSync
// should be done in run.sh ...

var SpmAgent = require('spm-agent')
var runningAgents = {}
var configModified = 0

function spmServiceRestart () {
  // this should scheduled every 10 seconds => CHECK_SERVICE_RESTART_INTERVAL=10000
  if (configModified > 0) {
    configModified = 0
    try {
      console.log(exec('service spm-monitor restart').toString())
    } catch (err) {
      console.error(err)
    }
  }
}
function AutoDiscovery (globalConfig, appConfig) {
  var DockerDiscovery = require('./dockerDiscovery')
  console.log('Watching Docker Events for automatic application discovery')
  var dockerDiscovery = new DockerDiscovery({
    image: new RegExp(appConfig.matchImageName),
    container: new RegExp(appConfig.matchContainerName),
    startFunction: function (dockerEvent, containerInfo) {
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
      var useSSL = false
      var httpPort
      var httpsPort
      if (appConfig.dockerNetwork === 'host') {
        SpmAgent.Logger.info('Using host network: ' + appConfig.dockerNetwork)
        if (containerInfo.NetworkSettings.Ports &&
          containerInfo.NetworkSettings.Ports[appConfig.sslPortInContainer] &&
          containerInfo.NetworkSettings.Ports[appConfig.sslPortInContainer].length > 0) {
            host = containerInfo.NetworkSettings.Ports[httpsPort][0].HostIp
            port = containerInfo.NetworkSettings.Ports[httpsPort][0].HostPort
            useSSL = true
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
        host = containerInfo.NetworkSettings.IPAddress
      }
      var url = ''
      if (useSSL) {
        url = 'https://' + host + ':' + port
      } else {
        url = 'http://' + host + ':' + port
      }
      if (port > 0) {
        SpmAgent.Logger.info('Start monitoring container: ' + containerInfo.name)
        var templateContext = {
          globalConfig: globalConfig,
          config: appConfig,
          spmToken: spmToken,
          containerId: dockerEvent.id,
          // sorry for upper case properties, but #golang/#docker uses uppercase JSON properties 
          containerName: containerInfo.Name.replace(/\//,'').replace(/\:|\-|\s/g,'_'), // remove leading "/"
          containerEnv: containerInfo.Config.Environment,
          containerLabels: containerInfo.Config.Labels,
          container: containerInfo,
          dockerEvent: dockerEvent,
          host: host,
          port: port
        }
        if (!templateContext.spmToken) {
          console.log("Missing SPM token for " + containerInfo.Image + '/' + containerInfor.Name)
          return
        }
        templateContext.spmConfig = ''
        // generate -P:KEY:VALUE options for spm-client-setup.sh
        Object.keys(appConfig.spmConfig).forEach(function (key) {
          templateContext.spmConfig = templateContext.spmConfig + ' -P:' + key + '=' + format(appConfig.spmConfig[key], templateContext)
        })
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
          configModified = configModified + 1
        } catch (err) {
          SpmAgent.Logger.error(err)
        }
      }
    },
    stopFunction: function (dockerEvent, containerInfo) {
      var agent = runningAgents[dockerEvent.id]
      if (agent) {
        console.log(agent.removeCmd)
        exec(agent.removeCmd)
        configModified = configModified + 1
        SpmAgent.Logger.info('Stop monitoring for container ' + dockerEvent.id)
      }
      delete runningAgents[dockerEvent.id]
    }
  })
}
// activate all apps for auto-discovery
Object.keys(rcConfig.spmAppTemplates).forEach (function (key) {
  var autodisco = new AutoDiscovery(rcConfig, rcConfig.spmAppTemplates[key])
})

// check every 10 seconds if spm service needs a restart
setInterval(spmServiceRestart, CHECK_SERVICE_RESTART_INTERVAL)
process.on('uncaughtException', function (err) {
  console.error((new Date()).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})