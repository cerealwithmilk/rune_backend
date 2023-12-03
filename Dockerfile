FROM node:lts-alpine
WORKDIR /usr/runesoftware

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 80
RUN npm run production
