#!/usr/bin/env node
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
  nginx: {
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
    console.error('Error writing configuration file for nginx:', err)
  } else {
    runCommand()
    process.exit(0)
  }
})

function runCommand () {
  child = spawn('sematext-agent-nginx', ['--config', argv['config']], {
    stdio: 'ignore',
    detached: true,
    env: process.env
  })
  child.unref()
  child.on('error', function (err) { console.error(err.stack) })
  // console.log(child)
}
