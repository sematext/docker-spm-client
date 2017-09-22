#!/usr/bin/env node
// usage: setup-httpd --token ${spmToken} --url http://${host}:${port}/status --config "/tmp/${containerName}.yml"
var minimist = require('minimist')
var argv = minimist(process.argv.slice(2))
var writeYAML = require('write-yaml')
var spawn = require('child_process').spawn
var child = null

console.log(argv)
var cfg = {
  tokens: {
    spm: argv['token']
  },
  httpd: {
    url: argv['url']
  }
}
if (argv['phpFpmUrl']) {
  cfg.phpFpm = {
    phpFpm: argv['pgpFpmUrl']
  }
}

writeYAML(argv['config'], cfg, function (err) {
  if (err) {
    console.error('Error writing configuration file for httpd:', err)
  } else {
    runCommand()
  }
})

function runCommand () {
  child = spawn('sematext-agent-httpd', ['--config', argv['config']], {
    stdio: ['ignore', process.stdout, process.stderr],
    detached: true,
    env: process.env,
    error: console.error
  })
  child.unref()
  child.on('error', function (err) { console.error(err.stack) })
  console.log(child)
}
