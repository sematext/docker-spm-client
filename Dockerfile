FROM debian:jessie

ENV DEBIAN_FRONTEND noninteractive

RUN \
  echo "deb http://http.debian.net/debian jessie-backports main" >>/etc/apt/sources.list && \
  apt-get -qqy update && \
  apt install -qqy -t jessie-backports \
    openjdk-8-jre-headless \
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
    build-essential && \
  apt-get remove --purge --auto-remove systemd -y && \
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash - && \
  # echo "deb http://pub-repo.sematext.com/debian sematext main" >>/etc/apt/sources.list && \
  wget -o - https://pub-repo.sematext.com/debian/sematext.gpg.key | apt-key add - && \
  apt-get update -qqy && \
  curl -o ./spm-client.deb  http://pub-repo.sematext.com/onpremises/spm-client-3.0.0.noarch.deb && \
  dpkg -i ./spm-client.deb && \
  apt-get -f install \
  apt-get install --force-yes -qqy nodejs && \
  apt-get autoremove && apt-get autoclean && rm ./spm-client.deb &&\
  rm -rf /var/lib/apt/lists/* && \
  npm i spm-agent-mongodb sematext-agent-httpd sematext-agent-nginx -g

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
