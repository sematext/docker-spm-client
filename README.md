# SPM Client 

This Docker Image contains [SPM](https://sematext.com/spm) Client. 

SPM Client is an Application Monitoring agent for the following Applications:

Solr & SolrCloud, Elasticsearch, Apache Spark, Apache Storm, Apache
Kafka, Apache Cassandra, Akka, HBase, Hadoop, Apache2, Nginx, Nginx
Plus, Tomcat, HAProxy, Redis, Memcached, MySQL and MariaDB, AWS EC2,
ELB, EBS, RDS, JVM / Java and Scala Applications, ...

Please note: to monitor Docker, CoreOS, RancherOS, etc. themselves use [sematext/sematext-agent-docker](https://github.com/sematext/sematext-agent-docker)

Also, monitoring of Node.js for Express, Hapi.js, Koa Apps, etc. is not included in this image - use [sematext/spm-agent-nodejs](https://github.com/sematext/spm-agent-nodejs) for that.
...

# Installation 

```.sh
# multiple Apps can be configured using ";" as separator
# SPM_CONFIG="YOUR_SPM_CONFIG_STRINGS"
# Elasticsearch Example
export SPM_CONFIG="YOUR_SPM_TOKEN es javaagent jvmname:ES1"
docker run --name spm-client --restart=always -e $SPM_CONFIG sematext/spm-client

```

# Examples
- [How to use SPM Client Container with Elasticsearch](http://blog.sematext.com/2015/10/28/docker-elasticsearch-how-to-monitor-the-official-elasticsearch-image-on-docker/)
- [How use SPM Client Container with Solr](http://blog.sematext.com/2015/12/09/docker-solr-monitoring/)
- [Monitoring Kafka on Docker Cloud](https://sematext.com/blog/2016/04/19/monitoring-kafka-on-docker-cloud/)
- [Gist: Docker Compose Examples for Tomcat in-process and standalone monitoring](https://gist.github.com/megastef/ada049814fdb69ddca5eff296555b99c)


Parameters:
- SPM_CONFIG - Multiple App configurations for spm-client-setup-conf.sh separated by ";". 

Any Linux command can be executed to modify the configuration using "docker exec -it spm-client your_linux_command" :

```
# An alternative way to configure Elasticsearch to set  e.g. jvmname 'ES1'
docker exec -it spm-client /bin/bash /opt/spm/bin/spm-setup-conf.sh YOUR_SPM_TOKEN es javaagent jvmname:ES1
# persist config changes
docker commit spm-client
```

# Support
- Follow us on Twitter @sematext
- E-Mail support: support@sematext.com
- Support [Chat](https://apps.sematext.com/users-web/login.do) 

