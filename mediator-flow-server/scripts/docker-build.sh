#!/bin/bash
# Build the MediatorFlow production Docker image.
# Usage: ./scripts/docker-build.sh [version]
# Default version is read from package.json

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./package.json').version")}"
IMAGE="rolandsall24/mediatorflow"

echo "Building $IMAGE:$VERSION ..."
docker build -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .
echo "Done. Tagged: $IMAGE:$VERSION, $IMAGE:latest"
