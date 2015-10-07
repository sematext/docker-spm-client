# SPM Client 

This Docker Image contains [SPM](https://www.sematext.com/spm) Client. 

SPM Client is an application monitoring agent for the following Applications:

Solr & SolrCloud, Elasticsearch, Apache Spark, Apache Storm, Apache Kafka, Apache Cassandra, 
Hbase, Hahoop, Apache2 and Apache Tomacat Webservers, Nginx, Nginx Plus, HAProxy, Redis, Memcached, MySQL & MariaDB, AWS EC2, ELB, EBS, RDS, JVM / Java Applications, ...

Please note there are separate monitoring agents available for other technologies not covered by this Image e.g. Docker, CoreOS (sematext/spm-agent-docker) and Node.js for Express, Hapi.js, Koa Apps ...

# Installation 

```.sh
# multiple Apps can be configured using ";" as separator
# SPM_CONFIG="YOUR_SPM_CONFIG_STRINGS"
# Elasticsearch Example
export SPM_CONFIG="YOUR_SPM_TOKEN es javagent jvmname:ES1"
docker run --name spm-client --restart=always -e SPM_CONFIG sematext/spm-client

```

# Example

In the following example we see options, for the SPM In-Process monitor to inject a .jar file from SPM Client Volume.
The ES_JAVA_OPTS string is taken from SPM install instructions - using the SPM Token and naming the JVM (in case you like to run N instances on the same host). 

```

docker run -d --name “ES1” -d \
--volumes-from spm-client \
-e ES_JAVA_OPTS="-Dcom.sun.management.jmxremote -javaagent:/opt/spm/spm-monitor/lib/spm-monitor-es.jar=YOUR_SPM_TOKEN::ES1 -Des.node.name=ES1" \
-p 9200:9200 elasticsearch 

```

Parameters:
- SPM_CONFIG - Multiple App configurations for spm-client-setup-conf.sh separated by ";". 

Any Linux command can be executed to modify the configuration using "docker exec -it spm-client your_linux_command" :

```
# An alternative way to configure Elasticsearch to set  e.g. jvmname 'ES1'
docker exec -it spm-client /bin/bash /opt/spm/bin/spm-setup-conf.sh YOUR_SPM_TOKEN es javagent jvmname:ES1
# persist config changes
docker commit spm-client
```

# Support
- Follow us on Twitter @sematext
- E-Mail support: support@sematext.com
- Support [Chat](https://apps.sematext.com/users-web/login.do) 

