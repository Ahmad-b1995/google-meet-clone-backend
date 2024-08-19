# Stage 1: Build the TypeScript code
FROM node:20.12.2 AS build

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
FROM node:20.12.2

# Set the working directory
WORKDIR /app

# Copy only the built files from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json yarn.lock* ./

# Install only production dependencies using yarn with verbose output
RUN yarn install --frozen-lockfile --production --verbose

# Expose the port the app runs on
EXPOSE 3000

# Command to start the app
CMD ["node", "build/src/main.js"]
