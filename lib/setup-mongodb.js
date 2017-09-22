#!/usr/bin/env node
// usage: setup-mongodb --token ${spmToken} --url mongodb://${host}:${port}/admin --config "/tmp/${containerName}.yml"
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
  mongodb: {
    url: [{url: argv['url']}]
  }
}

writeYAML(argv['config'], cfg, function (err) {
  if (err) {
    console.error('Error writing configuration file for mongodb:', err)
  } else {
    runCommand()
  }
})

function runCommand () {
  child = spawn('spm-agent-mongodb', ['--config', argv['config']], {
    stdio: ['ignore', process.stdout, process.stderr],
    detached: true,
    env: process.env,
    error: console.error
  })
  child.unref()
  child.on('error', function (err) { console.error(err.stack) })
  console.log(child)
}
