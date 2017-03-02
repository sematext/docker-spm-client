var Docker = require('dockerode')
var docker = new Docker()
var flat = require('flat')
var cache = {}

function DockerInspect (options) {
  this.options = options
}

DockerInspect.prototype.inspectHandler = function (err, info) {
  if (!err && info) {
    info.flat = flat(info)
    cache[this.container] = info
    this.callback(null, info)
  } else {
    this.callback(null, {
      id: this.container
    })
  }
}

DockerInspect.prototype.inspect = function (id, cb) {
  if (!cache[this.container]) {
    docker.getContainer(id).inspect(this.inspectHandler.bind({
      callback: cb,
      container: id
    }))
  } else {
    cb(null, cache[this.container])
  }
}
module.exports = new DockerInspect()