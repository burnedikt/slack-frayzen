FROM node:8-alpine
WORKDIR /src
COPY * /src/
RUN npm install
CMD node index.js