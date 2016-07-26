FROM debian:jessie 
RUN echo "deb http://http.debian.net/debian jessie-backports main" >> /etc/apt/sources.list && \
    apt-get update && apt-get install -y sudo wget zip openjdk-8-jre-headless sysvinit-core sysvinit-utils && \
    apt-get remove --purge --auto-remove systemd -y && \
    apt-get upgrade -y 
RUN echo "deb http://pub-repo.sematext.com/debian sematext main" >> /etc/apt/sources.list && \
    wget -O - https://pub-repo.sematext.com/debian/sematext.gpg.key |  apt-key add - && \
    apt-get update -y && \
    apt-get install --force-yes -y spm-client && \
    apt-get autoremove && apt-get autoclean 
ADD ./run.sh /run.sh
ADD ./netmap.sh /opt/spm/bin/netmap.sh
RUN chmod +x run.sh && chmod +x /opt/spm/bin/netmap.sh && \
    chmod +x /opt/spm/bin/spm-client-setup-conf.sh && \
    ln /usr/bin/env /bin/env
ENV PATH ${PATH}:/opt/spm/bin/
VOLUME /opt/spm
CMD ["/run.sh"]