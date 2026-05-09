FROM golang:1.26.1-bookworm

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Go dev tools
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest && \
    go install github.com/air-verse/air@latest && \
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Atuin (shell history — matches devbox environment)
RUN curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh || true
ENV PATH="/root/.cargo/bin:${PATH}"

# Persist PATH in shell config
RUN echo 'export PATH="/root/.bun/bin:/root/.cargo/bin:$PATH"' >> /root/.bashrc && \
    echo 'export PATH="/root/.bun/bin:/root/.cargo/bin:$PATH"' >> /root/.profile

WORKDIR /workspace
