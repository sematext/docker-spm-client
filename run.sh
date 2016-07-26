#!/usr/bin/env bash
# Configure SPM 
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

IFS=$IFS_ORIGINAL
bash /opt/spm/bin/spm-client-setup-os-conf.sh
/etc/init.d/spm-monitor start
tail -F /opt/spm/spm-monitor/logs/*/*.log | grep -v INFO

