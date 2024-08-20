# Stage 1: Build the TypeScript code
FROM node:22 as builder

LABEL stage="builder" \
    description="Stage to build the TypeScript application" \
    maintainer="Ahmad Baghereslami <ahmad.b1995@gmail.com>"

# Install build tools necessary for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package*.json yarn.lock* ./

# Install dependencies using yarn with verbose output
RUN yarn install --frozen-lockfile --verbose

# Copy the rest of the application code
COPY . .

# Build the application
RUN yarn run build

# Stage 2: Run the application
FROM node:22 as runner

LABEL stage="runner" \
    description="Stage to run the TypeScript application" \
    maintainer="Ahmad Baghereslami <ahmad.b1995@gmail.com>"

# Set the working directory
WORKDIR /app

# Copy only the built files from the build stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json yarn.lock* ./

# Install only production dependencies using yarn with verbose output
RUN yarn install --frozen-lockfile --production --verbose

# Expose the port the app runs on
EXPOSE 3000

# Command to start the app
CMD ["node", "/app/build/src/main.js"]
