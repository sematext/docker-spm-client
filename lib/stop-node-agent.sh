#!/bin/bash
rm $1
kill $(ps -ef | grep "$1" | head -1 | awk '{print $2}')
