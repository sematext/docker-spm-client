var RcYaml = require('rc-yaml-2')
var rcConfig = new RcYaml('spm')
var format = require('es6-template-strings')
// require('string-template')

console.log(rcConfig)
console.log(rcConfig.spmAppTemplates.elasticsearch.imageName.test('elasticsearch'))

var exec = require('child_process').execSync
// should be done in run.sh ...
process.env.SPM_LOG_TO_CONSOLE = 'true'
var SpmAgent = require('spm-agent')
var runningAgents = {}

function AutoDiscovery (globalConfig, appConfig) {
  var DockerDiscovery = require('./dockerDiscovery')
  console.log('Watching Docker Events for automatic application discovery')
  var dockerDiscovery = new DockerDiscovery({
    image: new RegExp (appConfig.imageName),
    startFunction: function (dockerEvent, containerInfo) {
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
        SpmAgent.Logger.info('container labels', containerInfo.Config.Labels)
      }
      if (!(containerInfo.Config.Labels['SPM_TOKEN'] || containerInfo.Config.Environment['SPM_TOKEN'] || appConfig.spmToken)) {
        SpmAgent.Logger.info('No SPM_TOKEN set for image/container ' + containerInfo.Config.Image + containerInfo.Name)
        SpmAgent.Logger.info('Skip monioring for image/container ' + containerInfo.Config.Image + containerInfo.Name)
        return
      }
      // console.log(containerInfo.NetworkSettings.Ports[appConfig.portInContainer])
      var host = containerInfo.NetworkSettings.IPAddress
      var filterValue = dockerEvent.id.substring(0, 12)
      var port = 0
      var useSSL = false
      var httpPort
      var httpsPort
      if (appConfig.dockerNetwork === 'host') {
        SpmAgent.Logger.info('using host network: ' + appConfig.dockerNetwork)
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
        SpmAgent.Logger.info('using container network (' + (appConfig.dockerNetwork || 'default/bridge') + ')')
        port = appConfig.portInContainer.replace('/tcp', '').replace('/udp', '')
        host = containerInfo.NetworkSettings.IPAddress
      }
      var url = ''
      if (useSSL) {
        url = 'https://' + host + ':' + port
      } else {
        url = 'http://' + host + ':' + port
      }
      if (port > 0) {
        filterValue = filterValue + '_' + host + ':' + port
        SpmAgent.Logger.info('start monitoring: ' + url + ' container: ' + filterValue)
        var templateContext = {
          globalConfig: globalConfig,
          config: appConfig,
          spmToken: containerInfo.Config.Labels['SPM_TOKEN'] || appConfig.spmToken,
          containerId: dockerEvent.id,
          containerEnv: containerInfo.Config.Environment,
          containerLabels: containerInfo.Config.Labels,
          container: containerInfo,
          dockerEvent: dockerEvent,
          host: host,
          port: port
        }
        var spmProperties = ''
        Object.keys(appConfig.spmConfigProperties).forEach(function (key) {
          spmProperties = spmProperties + ' -P:' + key + '=' + format(appConfig.spmConfigProperties[key], templateContext)
        })
        templateContext.spmProperties = spmProperties
        var spmConfig = format(appConfig.spmConfigTemplate, templateContext)
        templateContext.spmConfig = spmConfig
        var cmd = format('${spmConfig} ${spmProperties}', templateContext)
        console.log(cmd)
        try {
          console.log(exec(cmd).toString())
          runningAgents[dockerEvent.id] = {
            containerId: dockerEvent.id,
            spmToken: appConfig.spmToken,
            setupCmd: cmd
          }
          console.log(exec('service spm-monitor restart').tostring())
          console.log(dockerEvent.id, runningAgents[dockerEvent.id])
        } catch (err) {
          SpmAgent.Logger.error(err)
        }
      }
    },
    stopFunction: function (dockerEvent) {
      var agent = runningAgents[dockerEvent.id]
      if (agent) {
        var removeCmd = format('${gloablConfig.removeCommand} ${agent.spmToken} ${agent.containerId}')
        console.log(removeCmd)
        exec(removeCmd)
        // TODO: this should scheduled once per minute (max)
        console.log(exec('service spm-monitor restart').toString())
        SpmAgent.Logger.info('stop monitoring for Elasticsearch container ' + dockerEvent.id)
      }
      delete runningAgents[dockerEvent.id]
    }
  })
}
// activate all apps for auto-discovery
Object.keys(rcConfig.spmAppTemplates).forEach (function (key) {
  var autodisco = new AutoDiscovery(rcConfig, rcConfig.spmAppTemplates[key])
}) 


process.on('uncaughtException', function (err) {
  console.error((new Date()).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})
