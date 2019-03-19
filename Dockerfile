FROM debian:stretch

ENV DEBIAN_FRONTEND noninteractive
ENV TERM xterm
RUN \
  echo "deb http://http.debian.net/debian stretch-backports main" >>/etc/apt/sources.list && \
  apt-get -qqy update && \
  apt install -qqy -t stretch-backports \
    openjdk-11-jre-headless \
    ca-certificates-java && \
  apt-get install -qqy \
    apt-utils \
    procps \
    socat \
    sudo \
    wget \
    curl \
    cron \
    ntp \
    python \
    jq \
    sysvinit-core \
    sysvinit-utils \
    build-essential \
    libpcap-dev && \
  apt-get remove --purge --auto-remove systemd -y && \
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash - 
RUN \
  echo "deb http://pub-repo.sematext.com/debian sematext main" | tee /etc/apt/sources.list.d/sematext.list > /dev/null &&\
  wget -O - https://pub-repo.sematext.com/debian/sematext.gpg.key | apt-key add - &&\
  apt-get update &&\
  apt-get -qqy install spm-client 

# Disable infra agent
RUN \
  sed -e '/startInfraAgent$/ s/^#*/#/' -i /etc/init.d/spm-monitor

RUN  apt-get install -qqy nodejs 
RUN apt-get autoremove && apt-get autoclean  
RUN rm -rf /var/lib/apt/lists/* 
RUN npm i spm-agent-mongodb sematext-agent-httpd sematext-agent-nginx -g

ADD ./run.sh /run.sh
ADD ./docker-info.js /tmp/di/docker-info.js
ADD ./autoDiscovery.yml /tmp/di/autoDiscovery.yml
ADD ./lib /tmp/di/lib
ADD ./package.json  /tmp/di/package.json
ADD ./netmap.sh /opt/spm/bin/netmap.sh

RUN chmod +x run.sh \
             /opt/spm/bin/netmap.sh \
             /opt/spm/bin/spm-client-setup-conf.sh \
             /tmp/di/docker-info.js
RUN ln /usr/bin/env /bin/env 
RUN npm i /tmp/di/ -g 

ENV PATH ${PATH}:/opt/spm/bin/

VOLUME /opt/spm
CMD ["/run.sh"]
