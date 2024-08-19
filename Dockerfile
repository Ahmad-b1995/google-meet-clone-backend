# Stage 1: Build the TypeScript code
FROM node:22-alpine3.19 as builder

LABEL stage="builder" \
    description="Stage to build the TypeScript application" \
    maintainer="Ahmad Baghereslami <ahmad.b1995@gmail.com>"

# Install build tools necessary for native modules and libc6-compat
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

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
FROM node:22-alpine3.19 as runner

LABEL stage="runner" \
    description="Stage to run the TypeScript application" \
    maintainer="Ahmad Baghereslami <ahmad.b1995@gmail.com>"

# Install libc6-compat to resolve glibc dependencies
RUN apk --no-cache add libc6-compat

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
CMD ["node", "build/src/main.js"]
