#!/bin/bash
rm $1
COMMAND="kill $(ps -ef | grep $1 | head -1 | awk '{print $2}')"
echo $COMMAND
${COMMAND}
