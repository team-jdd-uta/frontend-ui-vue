FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_USER_INFO_SERVER_URL=/api
ARG VITE_LOGIN_SERVER_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USER_INFO_SERVER_URL=$VITE_USER_INFO_SERVER_URL
ENV VITE_LOGIN_SERVER_URL=$VITE_LOGIN_SERVER_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
