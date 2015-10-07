#!/bin/bash
if [[ -n "$1" && -n "$2" ]] ; then 
	export SPM_TOKEN=$1
	if [  "$2" == "all" ]; then
		export NET_IF=$(ip link show | grep -v link | grep -v lo| awk '{split($2,a,":");print a[1]}' | xargs | sed -e "s/ /,/g")    
	else  
		export NET_IF=$1
	fi
	sed -i s/NETWORK_INTERFACES.*/NETWORK_INTERFACES=\"${NET_IF}\"/ /opt/spm/spm-monitor/conf/spm-monitor-network-config-${SPM_TOKEN}-default.properties
	cat /opt/spm/spm-monitor/conf/spm-monitor-network-config-${SPM_TOKEN}-default.properties
else
	echo "usage: netmap TOKEN interface"
	echo "e.g. netmap.sh XXXXXXX all"
	echo "e.g. netmap.sh XXXXXXX \"eth0, eth1\""
fi
