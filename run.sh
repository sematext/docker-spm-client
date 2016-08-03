#!/usr/bin/env bash
# Configure SPM 
function get_docker_info () 
{
	export DOCKER_SOCKET=/var/run/docker.sock
	if test -r $DOCKER_SOCKET; then
		socat TCP-LISTEN:2375,reuseaddr,fork UNIX:/var/run/docker.sock & 
		export SOCAT_PID=$!
		sleep 1
		export DOCKER_INFO=$(curl --silent http://localhost:2375/info)
		sleep 1
		kill ${SOCAT_PID} > /dev/null
		echo "docker_id=$(echo ${DOCKER_INFO} | jq '.ID' | sed s/\"//g)" > /opt/spm/.docker
		echo "docker_hostname=$(echo ${DOCKER_INFO} | jq '.Name' | sed s/\"//g)" >> /opt/spm/.docker
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
function spm_client_setup () 
{
	#Set the field separator to new line
	IFS_ORIGINAL=$IFS
	SPM_STANDALONE_MONITOR="disabled"
	IFS=";"
	if [ -n "$SPM_CONFIG" ]; then
		for cfg in $SPM_CONFIG
		do
		  set IFS = $IFS_ORIGINAL	
		  echo "-" "$cfg"  
		  bash -c "/opt/spm/bin/spm-client-setup-conf.sh $cfg"
		  # Check for standalone monitors
		  case "$cfg" in
		    *standalone* ) export SPM_STANDALONE_MONITOR="enabled"; echo "Standalone Monitor enabled for: $cfg";;
		  esac
		done
	fi
    #sed -i s/spm_sender_hostname_alias=$/spm_sender_hostname_alias=${HOSTNAME}/g /opt/spm/properties/spm-sender.properties
    IFS=$IFS_ORIGINAL
}

get_docker_info
spm_client_setup 

/etc/init.d/spm-monitor restart
# /bin/bash /opt/spm/spm-monitor/bin/spm-monitor-starter.sh /opt/spm/spm-monitor/conf/spm-monitor-os-config.properties —daemon & 
tail -F /opt/spm/spm-monitor/logs/*/*config*.log | grep -v INFO


