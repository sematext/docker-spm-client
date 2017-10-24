
## Swarm Installation 

__Step 1__

Install SPM-Client to all cluster nodes by deploying SPM-Client as global Swarm service:

```
docker service create --mode global --name spm-client \
--mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
sematext/spm-client:auto-discovery
```

### Optional environment variables: 

__Sematext Cloud__ 

- REGION - US or EU will set Sematext Cloud API endpoints for the given region

__Sematext Enterprise__ 

- METRICS_RECEIVER_URL - The metrics receiver URL for Sematext Enterprise
- TRACE_RECEIVER_URL - The metrics receiver URL for Sematext Enterprise
- EVENT_RECEIVER_URL - The events receiver URL for Sematext Enterprise
- LOG_TOKEN_RECEIVER_URL - The Logsene receiver URL for Sematext Enterprise


*Note: Skip Step 1, if you have already deployed SPM-Client on your cluster.*

__Step 2__

Tag your application container with the SPM_TOKEN by using an environment variable or Docker label. Docker Compose example for MongoDB:  

```
docker run -e SPM_TOKEN=YOUR_SPM_TOKEN_FOR_MONGODB mongo
```

## Kubernetes Installation

__Step 1__

Deploy SPM-Client as Daemonset to every Kubernetes node:

```

apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: sematext-spm-client
spec:
  template:
    metadata:
      labels:
        app: sematext-spm-client
    spec:
      nodeSelector: {}
      hostNetwork: true
      dnsPolicy: "ClusterFirst"
      restartPolicy: "Always"
      containers:
        - name:  semtext-spm-client
          image: sematext/spm-client:auto-discovery
          imagePullPolicy: "Always"
          env:
            - name: REGION
              value: US  # please set this value to "EU" for Sematext Cloud Europe
          volumeMounts:
            - mountPath: /var/run/docker.sock
              name: docker-sock
            - mountPath: /etc/localtime
              name: localtime
            - mountPath: /rootfs
              name: rootfs
              readOnly: true
          securityContext:
            privileged: true
      volumes:
        - name: docker-sock
          hostPath:
            path: /var/run/docker.sock
        - name: localtime
          hostPath:
            path: /etc/localtime
        - name: rootfs
          hostPath:
            path: /

```

### Optional environment variables: 

__Sematext Cloud__ 

- REGION - US or EU will set Sematext Cloud API endpoints for the given region

__Sematext Enterprise__ 

- METRICS_RECEIVER_URL - The metrics receiver URL for Sematext Enterprise
- TRACE_RECEIVER_URL - The metrics receiver URL for Sematext Enterprise
- EVENT_RECEIVER_URL - The events receiver URL for Sematext Enterprise
- LOG_TOKEN_RECEIVER_URL - The Logsene receiver URL for Sematext Enterprise


__Step 2__

Tag your application container with the SPM_TOKEN by using an environment variable or Docker label. Example POD for MongoDB: 

```

apiVersion: v1
kind: Pod
metadata:
  name: some-mongo
spec:
  containers:
    - image: launcher.gcr.io/google/mongodb3
      name: mongo
      ports:
        - containerPort: 27017
      env:
        - name: SPM_TOKEN
          value: YOUR_SPM_TOKEN_FOR_MONGODB

```










