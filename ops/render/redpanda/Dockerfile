FROM redpandadata/redpanda:23.3.11

EXPOSE 9092 8082 9644 33145

CMD [ \
  "redpanda", "start", \
  "--smp", "1", \
  "--reserve-memory", "0M", \
  "--overprovisioned", \
  "--memory", "1G", \
  "--node-id", "0", \
  "--check=false", \
  "--set", "redpanda.auto_create_topics_enabled=true", \
  "--kafka-addr", "0.0.0.0:9092", \
  "--advertise-kafka-addr", "redpanda:9092", \
  "--pandaproxy-addr", "0.0.0.0:8082", \
  "--advertise-pandaproxy-addr", "redpanda:8082", \
  "--rpc-addr", "0.0.0.0:33145", \
  "--advertise-rpc-addr", "redpanda:33145" \
]
