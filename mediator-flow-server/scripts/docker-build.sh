#!/bin/bash
# Build the MediatorFlow production Docker image for linux/amd64 and linux/arm64.
# Usage: ./scripts/docker-build.sh [version]
# Default version is read from package.json

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./package.json').version")}"
IMAGE="rolandsall24/mediatorflow"
BUILDER_NAME="mediatorflow-multiplatform"

# Create a buildx builder if it doesn't already exist
if ! docker buildx inspect "$BUILDER_NAME" &>/dev/null; then
  echo "Creating buildx builder: $BUILDER_NAME ..."
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  docker buildx use "$BUILDER_NAME"
fi

echo "Building $IMAGE:$VERSION for linux/amd64,linux/arm64 ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  --push \
  .

echo "Done. Pushed: $IMAGE:$VERSION, $IMAGE:latest (amd64 + arm64)"
