FROM debian:jessie
RUN echo "deb http://http.debian.net/debian jessie-backports main" >> /etc/apt/sources.list && \
    apt-get -qqy update && apt-get install -qqy socat sudo wget curl cron ntp python openjdk-8-jre-headless jq sysvinit-core sysvinit-utils build-essential && \
    apt-get remove --purge --auto-remove systemd -y && \
    curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash - && \
    echo "deb http://pub-repo.sematext.com/debian sematext main" >> /etc/apt/sources.list && \
	wget -O - https://pub-repo.sematext.com/debian/sematext.gpg.key |  apt-key add - && \
    apt-get update -qqy && \
    apt-get install --force-yes -qqy spm-client nodejs && \
    apt-get autoremove && apt-get autoclean && \
    npm i spm-agent-mongodb sematext-agent-httpd sematext-agent-nginx -g && npm i dockerode
ADD ./run.sh /run.sh
ADD ./docker-info.js /tmp/di/docker-info.js
ADD ./package.json  /tmp/di/package.json
ADD ./netmap.sh /opt/spm/bin/netmap.sh
RUN chmod +x run.sh && chmod +x /opt/spm/bin/netmap.sh && \
    chmod +x /opt/spm/bin/spm-client-setup-conf.sh && \
    chmod +x /tmp/di/docker-info.js && \
    ln /usr/bin/env /bin/env && \
    npm i /tmp/di/ -g 
ENV PATH ${PATH}:/opt/spm/bin/
VOLUME /opt/spm
CMD ["/run.sh"]
