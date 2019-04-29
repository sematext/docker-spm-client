# SPM Client 

This Docker Image contains the [Sematext Monitoring](https://sematext.com/spm) Agent.

Sematext Monitoring Agent supports the following Applications:

Solr & SolrCloud, Elasticsearch, Apache Spark, Apache Storm, Apache
Kafka, Apache Cassandra, Akka, HBase, Hadoop, Apache2, Nginx, Nginx
Plus, Tomcat, HAProxy, Redis, Memcached, MySQL and MariaDB, AWS EC2,
ELB, EBS, RDS, JVM / Java and Scala Applications, ...

See [all integrations](https://sematext.com/integrations) and see [collected performance metrics](https://sematext.com/docs/integrations) in [Sematext docs](https://sematext.com/docs).

Please note: to monitor Docker, Kubernetes, Rancher, etc. themselves use [Sematext Docker Agent](https://hub.docker.com/r/sematext/agent/)

Also, monitoring of Node.js for Express, Hapi.js, Koa Apps, etc. is not included in this image - use [sematext/spm-agent-nodejs](https://github.com/sematext/spm-agent-nodejs) for that.
...

# Installation 

```.sh
# multiple Apps can be configured using ";" as separator
# SPM_CONFIG="YOUR_SPM_CONFIG_STRINGS"
# Elasticsearch Example
export SPM_CONFIG="YOUR_SPM_TOKEN es javaagent jvmname:ES1"
docker run --name spm-client --restart=always -v /var/run/docker.sock:/var/run/docker.sock -e $SPM_CONFIG sematext/spm-client

```

# Examples
- [How to use SPM Client Container with Elasticsearch](https://blog.sematext.com/docker-elasticsearch-how-to-monitor-the-official-elasticsearch-image-on-docker/)
- [How use SPM Client Container with Solr](https://blog.sematext.com/docker-solr-monitoring/)
- [Monitoring Kafka on Docker Cloud](https://sematext.com/blog/monitoring-kafka-on-docker-cloud/)
- [Gist: Docker Compose Examples for Tomcat in-process and standalone monitoring](https://gist.github.com/megastef/ada049814fdb69ddca5eff296555b99c)
- [More examples](https://github.com/sematext/docker-spm-client/tree/master/examples)


Parameters:
- SPM_CONFIG - Multiple App configurations for spm-client-setup-conf.sh separated by ";". 
- SPM_CONFIG_IFS - A custom config separator in cases where ";" is used as part of a config (like haproxy stats url)

Any Linux command can be executed to modify the configuration using "docker exec -it spm-client your_linux_command" :

```
# An alternative way to configure Elasticsearch to set  e.g. jvmname 'ES1'
docker exec -it spm-client /bin/bash /opt/spm/bin/spm-setup-conf.sh YOUR_SPM_TOKEN es javaagent jvmname:ES1
# persist config changes
docker commit spm-client
```

# Support
- Follow us on Twitter @sematext
- E-mail support: support@sematext.com
- Support [Chat](https://apps.sematext.com/users-web/login.do) 
