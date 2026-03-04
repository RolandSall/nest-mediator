#!/bin/bash
# Push MediatorFlow image to DockerHub.
# Usage: ./scripts/docker-push.sh [version]
# Prerequisites: docker login
#
# NOTE: The multi-platform build script (docker-build.sh) already pushes
# during build via --push. This script is kept for manual re-pushes or
# single-platform local builds.

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./package.json').version")}"
IMAGE="rolandsall24/mediatorflow"

echo "Pushing $IMAGE:$VERSION ..."
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"
echo "Done. Pushed: $IMAGE:$VERSION, $IMAGE:latest"
