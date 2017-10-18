
## Swarm Installation 

Deploy SPM-Client as global Swarm service to every Swarm node:

```
docker service create --mode global --name spm-client \
--mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
sematext/spm-client:auto-discovery
```

Run you Application with the SPM_TOKEN: 

```
docker run -e SPM_TOKEN=YOUR_SPM_TOKEN_FOR_MONGODB mongo
```


