FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy sources
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
