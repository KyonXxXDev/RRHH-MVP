FROM node:24-alpine

WORKDIR /app

COPY . .

WORKDIR /app/backend

RUN npm install

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]