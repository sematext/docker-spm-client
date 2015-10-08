#!/usr/bin/env bash
# Configure SPM 
#Set the field separator to new line
IFS_ORIGINAL=$IFS
SPM_STANDALONE_MONITOR="disabled"
IFS=";"
if [ -n "$SPM_CONFIG" ]; then
	for cfg in $SPM_CFG
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

IFS=$IFS_ORIGINAL

/etc/init.d/collectd start
/etc/init.d/spm-sender start
if [  "$SPM_STANDALONE_MONITOR" == "disabled" ]; then
	echo "Standalone monitor is disabled"
else
	/etc/init.d/spm-monitor start
	tail -F /opt/spm/spm-monitor/logs/spm-monitor.log | grep -v INFO &
fi
tail -F /opt/spm/spm-sender/logs/spm-sender.log | grep -v INFO

