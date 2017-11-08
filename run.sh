#!/usr/bin/env bash
# Configure SPM
export STANDALONE_LOG_DIR=/opt/spm/spm-monitor/logs/standalone/

function get_docker_info ()
{
	export DOCKER_SOCKET=/var/run/docker.sock
	if test -r $DOCKER_SOCKET; then
		# nodejs based agents use SPM_REPORTED_HOSTNAME for the hostname field
		export SPM_REPORTED_HOSTNAME=$(docker-info Name)
		echo "docker_id=$(echo $(docker-info ID))" > /opt/spm/.docker
		echo "docker_hostname=${SPM_REPORTED_HOSTNAME}" >> /opt/spm/.docker
		chmod 555 /opt/spm/.docker
		echo content of /opt/spm/.docker:
		cat /opt/spm/.docker
	else
		echo "Docker Socket $DOCKER_SOCKET is not readable!"
		echo "Please add -v ${DOCKER_SOCKET}:${DOCKER_SOCKET} to the docker run command"
	    echo "This will let SPM agents collect the docker hostname to tag metrics."
		exit -1
	fi
}

function setup_httpd_agent ()
{
	IFS_ORIGINAL=$IFS
	IFS=' ' read -r -a array <<< "$1"
	echo "setup httpd " ${array[0]} ${array[2]}
	export SPM_TOKEN=${array[0]}
	export spmagent_httpd__url=${array[2]}
	sematext-agent-httpd ${array[0]} ${array[2]} > $STANDALONE_LOG_DIR/spm-monitor-${array[1]}-config-${array[0]}-default.log &
	unset SPM_TOKEN
	unset spmagent_httpd__url
	IFS=$IFS_ORIGINAL
}

function setup_nginx_agent ()
{
	IFS_ORIGINAL=$IFS
	IFS=' ' read -r -a array <<< "$1"
	echo "setup nginx " ${array[0]} ${array[2]}
	export SPM_TOKEN=${array[0]}
	export NGINX_STATUS_PATH=${NGINX_STATUS_PATH:/nginx_status}
	export DOCKER_AUTO_DISCOVERY=true
	export spmagent_nginx__url=${array[2]}
	sematext-agent-nginx ${array[0]} ${array[2]} > $STANDALONE_LOG_DIR/spm-monitor-${array[1]}-config-${array[0]}-default.log &
	unset SPM_TOKEN
	unset spmagent_nginx__url
	IFS=$IFS_ORIGINAL
}

function setup_mongodb_agent()
{
	IFS_ORIGINAL=$IFS
	IFS=' ' read -r -a array <<< "$1"
	echo "setup mongodb token="${array[0]} "url="${array[2]}
	export spmagent_mongodb__url=${array[2]}
	export SPM_TOKEN=${array[0]}
	spm-agent-mongodb ${array[0]} ${array[2]} > $STANDALONE_LOG_DIR/spm-monitor-${array[1]}-config-${array[0]}-default.log &
	unset SPM_TOKEN
	unset spmagent_mongodb__url
	IFS=$IFS_ORIGINAL
}

function spm_client_setup ()
{
	echo "spm_config_setup() $1"
	case "$1" in
	  *standalone* ) export SPM_STANDALONE_MONITOR="enabled"; echo "Standalone Monitor enabled for: $cfg";;
	esac
	export SPM_LOG_TO_CONSOLE=true
	case "$1" in
		*mongodb* ) setup_mongodb_agent "$1";;
		*httpd* ) setup_httpd_agent "$1";;
		*nginx* ) setup_nginx_agent "$1";;
		*) bash -c "spm-client-setup-conf.sh ${1}";;
	esac
}

function spm_client_setups ()
{
	#Set the field separator to new line
	IFS_ORIGINAL=$IFS
	SPM_STANDALONE_MONITOR="disabled"
	IFS=${SPM_CONFIG_IFS:-";"}
	if [ -n "$SPM_CONFIG" ]; then
		for cfg in $SPM_CONFIG
		do
		  IFS=$IFS_ORIGINAL
		  echo "-" "$cfg"
		  spm_client_setup "$cfg"
		  # bash -c "/opt/spm/bin/spm-client-setup-conf.sh $cfg"
		  # Check for standalone monitors
		done
	fi
    #sed -i s/spm_sender_hostname_alias=$/spm_sender_hostname_alias=${HOSTNAME}/g /opt/spm/properties/spm-sender.properties
    IFS=$IFS_ORIGINAL
}

function set_receiver () {
	if [ -n "$LOGS_TOKEN_RECEIVER_URL" ]; then
		export LOGSENE_RECEIVER_URL="${LOGS_TOKEN_RECEIVER_URL}"
	fi
	if [ -n "$EVENT_RECEIVER_URL" ]; then
		export EVENTS_RECEIVER_URL="${EVENT_RECEIVER_URL}"
	fi
	if [ -n "$METRICS_RECEIVER_URL" ]; then
	  echo "Set metrics-receiver: $METRICS_RECEIVER_URL"
	  bash /opt/spm/bin/spm-client-setup-env.sh metrics-receiver:$METRICS_RECEIVER_URL
	  export SPM_RECEIVER_URL=$METRICS_RECEIVER_URL
	fi
	if [ -n "$TRACE_RECEIVER_URL" ]; then
	  echo "Set tracing-receiver: $TRACE_RECEIVER_URL"
      bash /opt/spm/bin/spm-client-setup-env.sh tracing-receiver:$TRACE_RECEIVER_URL
    fi

	# Accept Region value, this might overwrite given receiver URL's!
	if [ -n "$REGION" ]; then
		# generate region receiver settings for Java based agents
		#                                                 $REGION converted to lowercase
		bash /opt/spm/bin/spm-client-setup-env.sh region:${REGION,,}
		# generate region receiver settings for nodejs based agents
		#                        $REGION converted to upper case
		sematext-nginx-setup -r ${REGION^^}
	fi
}

export PATH=$PATH:/opt/spm/bin

get_docker_info
set_receiver
spm_client_setups
export SPM_LOG_TO_CONSOLE='true'
export SPM_LOG_LEVEL='info'
auto-discovery --config /usr/lib/node_modules/docker-spm-client/autoDiscovery.yml &

/etc/init.d/spm-monitor restart
# /bin/bash /opt/spm/spm-monitor/bin/spm-monitor-starter.sh /opt/spm/spm-monitor/conf/spm-monitor-os-config.properties —daemon &
tail -F /opt/spm/spm-monitor/logs/*/*config*.log | grep -ie "[Error|excpetion|failed|timeout]"
