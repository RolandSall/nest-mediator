#!/bin/bash
# Push MediatorFlow image to DockerHub.
# Usage: ./scripts/docker-push.sh [version]
# Prerequisites: docker login

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./package.json').version")}"
IMAGE="rolandsall24/mediatorflow"

echo "Pushing $IMAGE:$VERSION ..."
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"
echo "Done. Pushed: $IMAGE:$VERSION, $IMAGE:latest"
