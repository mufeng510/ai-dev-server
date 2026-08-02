#!/usr/bin/env bash
set -euo pipefail

: "${DEV_UID:=1000}"
: "${DEV_GID:=1000}"
: "${JDK_VERSION:?JDK_VERSION is required}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod 0644 /etc/apt/keyrings/docker.gpg

docker_arch="$(dpkg --print-architecture)"
VERSION_CODENAME="$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release)"
test -n "${VERSION_CODENAME}"
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
  "${docker_arch}" "${VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y --no-install-recommends \
  bash-completion \
  build-essential \
  ca-certificates \
  clang \
  cmake \
  curl \
  dnsutils \
  docker-buildx-plugin \
  docker-ce-cli \
  docker-compose-plugin \
  fd-find \
  file \
  fzf \
  git \
  git-lfs \
  gnupg \
  gosu \
  iproute2 \
  iputils-ping \
  jq \
  less \
  locales \
  nano \
  netcat-openbsd \
  "openjdk-${JDK_VERSION}-jdk-headless" \
  openssh-client \
  pkg-config \
  procps \
  python-is-python3 \
  python3 \
  python3-pip \
  python3-venv \
  ripgrep \
  rsync \
  shellcheck \
  sqlite3 \
  tini \
  tmux \
  tree \
  unzip \
  vim \
  wget \
  xz-utils \
  zip \
  zsh

echo 'en_US.UTF-8 UTF-8' > /etc/locale.gen
locale-gen
update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

existing_group="$(getent group "${DEV_GID}" | cut -d: -f1 || true)"
if [ -n "${existing_group}" ] && [ "${existing_group}" != dev ]; then
  groupmod --new-name dev "${existing_group}"
elif ! getent group dev >/dev/null; then
  groupadd --gid "${DEV_GID}" dev
fi

existing_user="$(getent passwd "${DEV_UID}" | cut -d: -f1 || true)"
if [ -n "${existing_user}" ] && [ "${existing_user}" != dev ]; then
  usermod --login dev --home /home/dev --move-home --shell /usr/bin/zsh --gid dev "${existing_user}"
elif ! id dev >/dev/null 2>&1; then
  useradd --uid "${DEV_UID}" --gid "${DEV_GID}" --create-home --shell /usr/bin/zsh dev
fi

install -d -o dev -g dev -m 0755 \
  /backups \
  /config \
  /data \
  /logs \
  /models \
  /workspace \
  /home/dev/.cache \
  /home/dev/.local/bin
ln -sf /usr/bin/fdfind /usr/local/bin/fd
git lfs install --system --skip-repo

rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*.deb
