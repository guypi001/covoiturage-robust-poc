FROM redis:7.2-alpine

# Enable append-only persistence to avoid losing messages upon restarts.
CMD ["redis-server", "--appendonly", "yes"]
